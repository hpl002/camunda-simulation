var axios = require("axios").default;
var moment = require('moment');
const { Event } = require('./event')
const { Common } = require('./common')
const { MathHelper } = require('./math')
const { v4: uuidv4 } = require('uuid');

const Worker = {
  /**
   * @param  {} {id
   * @param  {} task}
   * check if there is an available resource with the provided identifier
   */
  isResourceAvailable: ({ workerId, controller }) => {
    Worker.resourceExists({ workerId, controller })
    const arr = controller.resourceArr.filter(e => e.id === workerId && e.available === true)
    return arr.length > 0
  },
  /**
   * @param  {} {workerId
   * @param  {} controller}
   * calculates the earliest at which the specified resource is available
   */
  howLongUntilResourceAvailable: ({ workerId, controller }) => {
    // get earliest time at which a resource of specified id is available
    Worker.resourceExists({ workerId, controller })
    let arr = controller.resourceArr.filter(e => e.id === workerId)
    arr = arr.map(e => e.lockedUntil)
    arr.sort((a, b) => b - a);
    return arr[0]
  },

  resourceExists: ({ workerId, controller }) => {
    const type = controller.resourceArr.filter(e => e.id === workerId)
    if (type.length < 1) throw new Error(`could not find any resource with the provided workerId: ${workerId}. \n Possible workerIds: ${controller.resourceArr.map(e => e.id)}`)
  },


  lockResource: ({ workerId, task, controller, lockedUntil }) => {
    /* find index of first resource that matches id and update this */
    Worker.resourceExists({ workerId, controller })
    const index = controller.resourceArr.findIndex(e => e.id === workerId && e.available === true)
    if (index === -1) throw new Error("could not find any resource with the provided workerId")
    controller.resourceArr[index].task = task
    controller.resourceArr[index].available = false
    controller.resourceArr[index].lockedUntil = lockedUntil
  },

  freeResource: ({ task, controller }) => {
    /* find index of first resource that matches id and update this */
    const index = controller.resourceArr.findIndex(e => e.task.id === task.id)
    if (index === -1) throw new Error("could not find any resource tied to provied task")
    controller.resourceArr[index].task = ""
    controller.resourceArr[index].available = true
    controller.resourceArr[index].lockedUntil = ""
  },
  getDuration: ({ task, attributesMap }) => {
    let type = Common.getAttribute({ task, attributesMap, key: `DURATION_TYPE` })
    if(!type) type = ""
    if (type.toUpperCase() === "NORMAL_DISTRIBUTION") {
      return MathHelper.normalDistribution({ task, attributesMap, type: "DURATION" })
    }
    else if (type.toUpperCase() === "RANDOM") {
      return MathHelper.random({ task, attributesMap, type: "DURATION" })
    }
    else if (type.toUpperCase() === "CONSTANT") {
      return MathHelper.constant({ task, attributesMap, type: "DURATION" })
    }
    else { return 0 }
  },

  getWaiting: ({ task, attributesMap }) => {
    let type = Common.getAttribute({ task, attributesMap, key: `WAITING_TYPE` })
    if(!type) type = ""
    if (type.toUpperCase() === "NORMAL_DISTRIBUTION") {
      return MathHelper.normalDistribution({ task, attributesMap, type: "WAITING" })
    }
    else if (type.toUpperCase() === "RANDOM") {
      return MathHelper.random({ task, attributesMap, type: "WAITING" })
    }
    else if (type.toUpperCase() === "CONSTANT") {
      return MathHelper.constant({ task, attributesMap, type: "WAITING" })
    }
    else { return 0 }
  },

  calculateInsertionTime: ({ task, attributesMap, clock, type }) => {
    let time;
    if (type === "start") {
      time = Worker.getWaiting({ task, attributesMap })
    }
    else if (type === "completion") {
      time = Worker.getDuration({ task, attributesMap })
    }
    else {
      throw new Error("could not calcualte insertion type for this unknown type", type)
    }
    return parseInt(clock) + time
  },

  getTasks: async ({ processInstanceId }) => {
    try {
      const { data } = await axios.get(`http://localhost:8080/engine-rest/external-task?processInstanceId=${processInstanceId}&active=true&priorityHigherThanOrEquals=0`)
      return data
    } catch (error) {
      console.error(error);
      throw error
    }
  },

  startProcess: async ({ event, controller }) => {
    const { processID } = controller

    event.data.variables.startTime = {
      "value": new Date(parseInt(controller.clock)).toISOString(),
      "type": "String"
    }

    const variableKeys = Object.keys(event.data.variables)
    variableKeys.forEach(key => {
      if(key.toUpperCase().includes("RANDOM")){
        event.data.variables[key].type = "integer" 
        event.data.variables[key].value = Math.round(Math.random()*100)
      } 
    });

    const basePath = process.env.PROCESS_ENGINE
    const reqUrl = `${basePath}/engine-rest/process-definition/key/${processID}/start`
    return axios.post(reqUrl, {
      ...event.data
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    })
  },

  startTask: async ({ task, controller }) => {
    let workerId = Common.getAttribute({ task, ...controller, key: "RESOURCE" })
    let completionTime = Worker.calculateInsertionTime({ task, ...controller, type: "completion" })

    const start = async (workerId) => {
      try {

        const obj = {
          "modifications": {
          }
        }

        obj.modifications[`${task.id}_startTime`] = {
          "value": new Date(parseInt(controller.clock)).toISOString(),
          "type": "String"
        }

        let response = await axios.post(`http://localhost:8080/engine-rest/process-instance/${task.processInstanceId}/variables`,
          obj)
        if (response.status !== 204) throw new Error("could not update variables on process while starting task")


        task.workerId = workerId
        const body = {
          "workerId": workerId,
          "lockDuration": 1800000
        }
        response = await axios.post(`http://localhost:8080/engine-rest/external-task/${task.id}/lock`, body)
        if (response.status !== 204) throw new Error("could not lock task")

        return { task, startTime: completionTime, type: "complete task" }
      } catch (error) {
        console.error(error);
        throw error
      }
    }


    if (!workerId) {
      workerId = "generic-worker"
      const s = await start(workerId)
      return s
    }
    else if (Worker.isResourceAvailable({ workerId, controller })) {

      //TODO: get workerid by querying db
      Worker.lockResource({ workerId, task, controller, lockedUntil: completionTime })
      const s = await start(workerId)
      return s
    }
    else if (!Worker.isResourceAvailable({ workerId, controller })) {

      // how long until resource is available again? 
      completionTime = Worker.howLongUntilResourceAvailable({ workerId, controller })
      const timestamp = moment.unix(completionTime);
      const m = ` -- start task: Worker unavailable -> Reschedule to ${timestamp.format("HH:mm:ss")}`
      console.log(m)
      return { task, startTime: completionTime, type: "start task" }
    }


  },

  completeTask: async ({ task, controller }) => {
    if (task.workerId && task.workerId !== "generic-worker") {
      Worker.freeResource({ task, controller })
    }

    const obj = {
      "modifications": {
      }
    }

    obj.modifications[`${task.id}_completeTime`] = {
      "value": new Date(parseInt(controller.clock)).toISOString(),
      "type": "String"
    }

    try {
      let response = await axios.post(`http://localhost:8080/engine-rest/process-instance/${task.processInstanceId}/variables`,
        obj)
      if (response.status !== 204) throw new Error("could not update variables on process while starting task")


      const body = {
        "workerId": task.workerId,
        "variables": {}
      }
      response = await axios.post(`http://localhost:8080/engine-rest/external-task/${task.id}/complete`, body)
      if (response.status !== 204) throw new Error("could not complete task")
    } catch (error) {
      console.error(error);
      throw error
    }
  },

  fetchAndAppendNewTasks: async ({ processInstanceId, controller }) => {
    //get tasks list from process engine. Filtered on the current process
    const tasks = await Worker.getTasks({ processInstanceId })
    while (tasks.length !== 0) {
      const currTask = tasks.pop()
      const timeStamp = Worker.calculateInsertionTime({ task: currTask, ...controller, type: "start" })
      controller.addEvent({ startTime: timeStamp, event: new Event({ task: { ...currTask }, type: "start task" }) })
      await Worker.setPriority({ processInstanceId: currTask.id })
    }
  },

  /**
   * @param  {} {processInstanceId}
   * force a negative priority on taks so that it does not show when pulling new tasks
   * this is used as a mechanism to ensure that we do not register the same pending task multiple times
   */
  setPriority: async ({ processInstanceId }) => {
    try {
      const response = await axios.put(`http://localhost:8080/engine-rest/external-task/${processInstanceId}/priority`, {
        "priority": -1
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      })
      if (response.status !== 204) throw new Error("could not update status on task")
    } catch (error) {
      console.error(error);
      throw error
    }


  },

}

exports.Worker = Worker;