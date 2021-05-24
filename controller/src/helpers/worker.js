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
   * returns an object with two arrays, one of all qualified and potential resources and one of those available
   */
  getAvailableResources: async ({ task, controller }) => {
    const response = {}
    const query = `MATCH (a:Activity)-[]-(l:Limitations)-[boundedBy]-(s:Specialization)-[linked]-(r:Resource) WHERE a.id="${task.activityId}" return r`
    let records = await executeQuery({ query })
    let resources = records.map(e => e.get("r"))
    resources = resources.map(e => e.properties.id)
    response.potential = resources
    resources.forEach(resource => {
      const r = controller.resourceArr.filter(e => e.id === resource)
      if (r.length === 0) {
        controller.resourceArr.push(new Resource({ id: resource }))
        logger.log("process", `could not find resource in controller. Adding new resource with id ${resource}`)
      }
    });
    let available = []

    //TODO: strategy for what resource to select if there are multiple available

    resources.forEach(resource => {
      const arr = controller.resourceArr.filter(e => e.id === resource && e.available === true)
      if (!!arr.length > 0) available.push(arr[0])
    });

    response.available = available
    return response
  },
  /**
   * @param  {} {workerId
   * @param  {} controller}
   * calculates the earliest at which the specified resource is available
   */
  howLongUntilResourceAvailable: async ({ potential, controller }) => {
    let resources = controller.resourceArr.map(r => { return { id: r.id, lockedUntil: r.lockedUntil } })

    let arr = controller.resourceArr.filter(e => potential.includes(e.id))
    arr = arr.map(e => e.lockedUntil)
    arr.sort((a, b) => b - a)
    return arr.pop()




    /* let resources = await executeQuery({ query })
    resources = resources.map(e => e.properties.name)

    let earliestTime = 99999999999999999999;

    resources.forEach(resource => {
      //find earliest time at which resource is available
      const test = controller.resourceArr.filter(e => e.id === resource)
      if (test.length > 0) {
        if (earliestTime > test[0].lockedUntil) earliestTime = test[0].lockedUntil
      }
    }); */


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
    logger.log("process", `locking resource ${controller.resourceArr[index].id} util ${Common.formatClock(lockedUntil)} on task ${task.activityId}`)
  },

  freeResource: ({ task, controller }) => {
    /* find index of first resource that matches id and update this */
    const index = controller.resourceArr.findIndex(e => e.task.id === task.id)
    if (index === -1) throw new Error("could not find any resource tied to provied task")
    controller.resourceArr[index].task = ""
    controller.resourceArr[index].available = true
    controller.resourceArr[index].lockedUntil = ""
    logger.log("process", `Freeing resource: ${controller.resourceArr[index].id}`)
  },

  /**
   * @param  {} {task
   * @param  {} timeSlotType}
   * Calcualte a duration for the before, during, after timeslot
   */
  getTiming: async ({ task, timeSlotType }) => {
    let query = `MATCH (a:Activity)-[]-(t:Timing)-[]-(d)-[]-(n:Distribution) WHERE a.id="${task.activityId}" AND "${timeSlotType}" IN labels(d) return n`
    let record = await executeQuery({ query })
    if (record.length > 0) {
      record = record.map(e => e.get("n"))[0]

      if (!record.properties.type) {
        logger.log("error", "distribution is configured incorrectly. Could not find type")
        throw new Error("distribution is configured incorrectly. Could not find type")
      }
      if (record.properties.type.toUpperCase() === "NORMALDISTRIBUTION") {
        const { m, sd } = record.properties
        return MathHelper.normalDistribution({ mean: m, sd })
      }
      else if (record.properties.type.toUpperCase() === "RANDOM") {
        const { min, max } = record.properties
        return MathHelper.random({ min, max })
      }
      else if (record.properties.type.toUpperCase() === "POISSON") {
        const { value } = record.properties
        return MathHelper.poisson({ value })
      }
      else if (record.properties.type.toUpperCase() === "BERNOULLI") {
        const { value } = record.properties
        return MathHelper.bernoulli({ value })
      }
      else if (record.properties.type.toUpperCase() === "CONSTANT") {
        const { value } = record.properties
        return MathHelper.constant({ value })
      }
    }
    else return 0
  },
  calculateInsertionTime: async ({ task, controller, type }) => {
    let time;
    if (type === "start") {
      time = await Worker.getTiming({ task, timeSlotType: "Before" })
    }
    else if (type === "completion") {
      time = await Worker.getTiming({ task, timeSlotType: "During" })
    }
    else {
      throw new Error("could not calcualte insertion type for this unknown type", type)
    }
    return parseInt(controller.clock) + time
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
    //initialize the random variables needed
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
    logger.log("process", `starting process. Case: ${data.id}`)
    await mongo.startEvent({ case_id: data.id, activity_id: "start", activity_start: Common.formatClock(controller.clock), activity_end: Common.formatClock(controller.clock), resource_id: "no-resource" })
    return data
  },

  startTask: async ({ task, controller, mongo }) => {
    let { potential, available } = await Worker.getAvailableResources({ task, controller })
    let workerId = undefined
    /**
     duration of task is calculated
     */
    let completionTime = await Worker.calculateInsertionTime({ task, controller, type: "completion" })

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
        logger.log("process", `Starting task ${task.activityId}at ${ Common.formatClock(controller.clock)} with resoruce ${task.workerId }}`)
        await mongo.startTask({ case_id: task.processInstanceId, activity_id: task.activityId, activity_start: Common.formatClock(controller.clock), resource_id: task.workerId })
        return { task, startTime: completionTime, type: "complete task" }
      } catch (error) {
        logger.log("error", error)
        throw error
      }
    }


    if (potential.length === 0) {
      workerId = "no-resource"
      const s = await start(workerId)
      return s
    }
    else {

      if (available.length > 0) {
        //TODO:  could use a strategy to determine what resource to select if there are multipe available. Spread workload evenly?     
        //TODO:  check if there is enough time left to even complete the task
        workerId = available[0].id
        Worker.lockResource({ workerId, task, controller, lockedUntil: completionTime })
        const s = await start(workerId)
        return s
      }
      else {
        //TODO:  check if there is enough time left to even complete the task
        completionTime = await Worker.howLongUntilResourceAvailable({ potential, controller })
        logger.log("process", `Found resource on task and resources is not available. Rescheduling to ${Common.formatClock(completionTime)}`)
        return { task, startTime: completionTime, type: "start task", reason: "Reschedule: Could not find any available resource" }
      }
    }
  },

  completeTask: async ({ task, controller, mongo }) => {
    if (task.workerId && task.workerId !== "no-resource") {
      Worker.freeResource({ task, controller })
    }
    try {
      const body = {
        "workerId": task.workerId,
        "variables": {}
      }
      response = await axios.post(`http://localhost:8080/engine-rest/external-task/${task.id}/complete`, body)
      if (response.status !== 204) throw new Error("could not complete task")
      logger.log("process", `Completing task ${task.activityId}at ${ Common.formatClock(controller.clock)} with resoruce ${task.workerId }}`)
      await mongo.completeTask({ case_id: task.processInstanceId, activity_id: task.activityId, activity_end: Common.formatClock(controller.clock) })
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
      const timeStamp = await Worker.calculateInsertionTime({ task: currTask, controller, type: "start" })
      //TODO: How should tasks be prioritized? Should new fetched evens be configured to run as soon as possible       
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