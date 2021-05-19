var axios = require("axios").default;
const { Event } = require('./event')
const { Resource } = require('./resource')
const { Common } = require('./common')
const { logger } = require('../helpers/winston')
const { executeQuery } = require('../helpers/neo4j')
const { MathHelper } = require('./math')

const Worker = {
  /**
   * @param  {} {id
   * @param  {} task}
   * check if there is an available resource with the provided identifier
   */
  getFirstAvailableResource: async ({ query, controller }) => {
    let resources = await executeQuery({query})
    resources = resources.map(e => e.properties.name)     
    resources.forEach(resource => {
      const r = controller.resourceArr.filter(e=>e.id===resource)
      if (r.length===0) {
        logger.log("info", `could not find resource in controller. Adding new resource with id ${resource}`)
        controller.resourceArr.push(new Resource({ id: resource }))
      }
      else{
        logger.log("info", `Not adding resource. Already exists resource with id: ${resource}`)
      }
    });

    let available = []

    resources.forEach(resource => {
      const arr = controller.resourceArr.filter(e => e.id === resource && e.available === true)
      if(!!arr.length > 0) available.push(arr[0])
    });
    
    
    return available
  },
  /**
   * @param  {} {workerId
   * @param  {} controller}
   * calculates the earliest at which the specified resource is available
   */
  howLongUntilResourceAvailable: async ({ query, controller }) => {
    // get earliest time at which a resource of specified id is available

    let resources = await executeQuery({query})
    resources = resources.map(e => e.properties.name)

    let earliestTime = 99999999999999999999;

    resources.forEach(resource => {
      //find earliest time at which resource is available
      const test = controller.resourceArr.filter(e => e.id === resource)
      if (test.length > 0) {
        if (earliestTime > test[0].lockedUntil) earliestTime = test[0].lockedUntil
      }
    });


    /* let arr = controller.resourceArr.filter(e => e.id === workerId)
    arr = arr.map(e => e.lockedUntil)
    arr.sort((a, b) => b - a); */
    return earliestTime
  },

  lockResource: ({ workerId, task, controller, lockedUntil }) => {
    /* find index of first resource that matches id and update this */
    const index = controller.resourceArr.findIndex(e => e.id === workerId && e.available === true)
    if (index === -1) throw new Error("could not find any resource with the provided workerId")
    controller.resourceArr[index].task = task
    controller.resourceArr[index].available = false
    controller.resourceArr[index].lockedUntil = lockedUntil
    logger.log("info", `locking resource ${controller.resourceArr[index].id} util ${Common.formatClock(lockedUntil)}`)
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
    if (!type) type = ""
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
    if (!type) type = ""
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
      logger.log("error", error)
      throw error
    }
  },

  startProcess: async ({ event, controller, mongo }) => {
    const { processID } = controller
    const variableKeys = Object.keys(event.data.variables)
    variableKeys.forEach(key => {
      if (key.toUpperCase().includes("RANDOM")) {
        event.data.variables[key].type = "integer"
        event.data.variables[key].value = Math.round(Math.random() * 100)
      }
    });

    const basePath = process.env.PROCESS_ENGINE
    const reqUrl = `${basePath}/engine-rest/process-definition/key/${processID}/start`
    const { data } = await axios.post(reqUrl, {
      ...event.data
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    })
    await mongo.startEvent({ case_id: data.id, activity_id: "start", activity_start: Common.formatClock(controller.clock), activity_end: Common.formatClock(controller.clock), resource_id: "generic-worker" })
    return data
  },

  startTask: async ({ task, controller, mongo }) => {
    let workerId = Common.getAttribute({ task, ...controller, key: "RESOURCE" })
    let completionTime = Worker.calculateInsertionTime({ task, ...controller, type: "completion" })
    const activity_id = controller.attributesMap[task.activityId].filter(e => e.name === "DESCRIPTION")[0].value


    const start = async (workerId,) => {
      try {
        await Common.refreshRandomVariables({ task })
        task.workerId = workerId
        const body = {
          "workerId": workerId,
          "lockDuration": 1800000
        }
        response = await axios.post(`http://localhost:8080/engine-rest/external-task/${task.id}/lock`, body)
        if (response.status !== 204) throw new Error("could not lock task")
        await mongo.startTask({ case_id: task.processInstanceId, activity_id, activity_start: Common.formatClock(controller.clock), resource_id: task.workerId })
        return { task, startTime: completionTime, type: "complete task" }
      } catch (error) {
        logger.log("error", error)
        throw error
      }
    }


    if (!workerId) {
      workerId = "generic-worker"
      const s = await start(workerId)
      return s
    }
    else {
      const available = await Worker.getFirstAvailableResource({ query: workerId, controller })
      if (available.length>0) {
        workerId = available[0].id
        Worker.lockResource({ workerId, task, controller, lockedUntil: completionTime })
        const s = await start(workerId)
        return s
      }
      else if (available.length<=0) {
        completionTime = await Worker.howLongUntilResourceAvailable({ query:workerId, controller })
        logger.log("info", `Found resoruce on task and resources is not available. Rescheduling to ${Common.formatClock(completionTime)}`)
        return { task, startTime: completionTime, type: "start task" }
      }
    }
  },

  completeTask: async ({ task, controller, mongo }) => {
    const activity_id = controller.attributesMap[task.activityId].filter(e => e.name === "DESCRIPTION")[0].value

    if (task.workerId && task.workerId !== "generic-worker") {
      Worker.freeResource({ task, controller })
    }
    try {
      const body = {
        "workerId": task.workerId,
        "variables": {}
      }
      response = await axios.post(`http://localhost:8080/engine-rest/external-task/${task.id}/complete`, body)
      if (response.status !== 204) throw new Error("could not complete task")
      await mongo.completeTask({ case_id: task.processInstanceId, activity_id, activity_end: Common.formatClock(controller.clock) })
    } catch (error) {
      logger.log("error", error)
      throw error
    }
  },

  fetchAndAppendNewTasks: async ({ processInstanceId, controller }) => {
    //get tasks list from process engine. Filtered on the current process
    const tasks = await Worker.getTasks({ processInstanceId })
    if (tasks.length !== 0) logger.log("info", `fetching new tasks from Camunda. Found a total of ${tasks.length} new tasks`)
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
      logger.log("error", error)
      throw error
    }


  },

}

exports.Worker = Worker;