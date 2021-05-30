var axios = require("axios").default;
const { Event } = require('../classes/Event')
const { Activity } = require('../classes/Activity')
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
    response.potential = task.resourceCandidates
    let available = []


    response.potential.forEach(resource => {
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
    let arr = controller.resourceArr.filter(e => potential.includes(e.id))
    arr = arr.map(e => e.lockedUntil)
    arr.sort((a, b) => b - a)
    return arr.pop()
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


  getTasks: async ({ processInstanceId }) => {
    try {
      const { data } = await axios.get(`${process.env.PROCESS_ENGINE}/engine-rest/external-task?processInstanceId=${processInstanceId}&active=true&priorityHigherThanOrEquals=0`)
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
    //await mongo.startEvent({ case_id: data.id, activity_id: "start", activity_start: Common.formatClock(controller.clock), activity_end: Common.formatClock(controller.clock), resource_id: "no-resource" })
    return data
  },

  startTask: async ({ task, controller, mongo }) => {
    const start = async ({ workerId, completionTime }) => {
      try {
        await Common.refreshRandomVariables({ task })
        task.workerId = workerId
        const body = {
          "workerId": workerId,
          "lockDuration": 1800000
        }
        response = await axios.post(`${process.env.PROCESS_ENGINE}/engine-rest/external-task/${task.id}/lock`, body)
        if (response.status !== 204) throw new Error("could not lock task")
        logger.log("process", `Starting task ${task.activityId}at ${Common.formatClock(controller.clock)} with resoruce ${task.workerId}}`)
        await mongo.startTask({ case_id: task.processInstanceId, activity_id: task.activityId, activity_start: Common.formatClock(controller.clock), resource_id: task.workerId })
        return { task, startTime: completionTime, type: "complete task" }
      } catch (error) {
        logger.log("error", error)
        throw error
      }
    }

    let { potential, available } = await Worker.getAvailableResources({ task, controller })
    // available here meaning that the resource is not tied to another task, it does not accout for scheduling
    let workerId = undefined
    let completionTime = 0



    if (!task.hasResourceCandidates) {
      // no resource no schedule
      workerId = "no-resource"
      completionTime = controller.clock + task.timing.duration()
      const s = await start({ workerId, completionTime })
      return s
    }
    else {
      if (available.length > 0) {
        const resourcesWithSchedules = available.filter(r => r.hasSchedule === true)
        const resourcesWithoutSchedules = available.filter(r => r.hasSchedule === false)
        if (!!resourcesWithSchedules.length === !!resourcesWithoutSchedules.length) throw new Error("Task cannot have resources with and without schedules. These are mutually exclusive")
        //account for resource schedules
        if (!!resourcesWithSchedules.length) {
          /* pass in clock and duration an then get back a time at which the task will be finished that accounts for duration  */
          available.map(r => {
            //get the duration of task
            let duration = task.timing.duration()
            //add additional duration due to resource (in)efficiency
            duration = r.efficiency({ time: duration, options: { iso: false } })
            r.earliestAvailable = r.addSchedulingTime({ clock: controller.clock, duration: task.timing.duration() })
          }
          )
          avalable = available.filter(e => e.earliestAvailable !== undefined)
          if (available.length === 0) throw new Error("Task duration exceeds the scheduling of any potential resources. There are no resources which can complete this task with their given schedule")
          available.sort((a, b) => b.earliestAvailable - a.earliestAvailable)
          console.log(`calculated insertion times for ${available.length} resources`)

          completionTime = available[0].earliestAvailable
          workerId = available[0].id
        }
        else {
          completionTime = controller.clock + task.timing.duration()
          workerId = available[0].id
        }

        Worker.lockResource({ workerId, task, controller, lockedUntil: completionTime })
        const s = await start({ workerId, completionTime })
        return s
      }
      else {
        // here we account for scenario where resource is bussy with other task
        const startTime = await Worker.howLongUntilResourceAvailable({ potential, controller })
        logger.log("process", `Found resource on task and resources is not available. Rescheduling to ${Common.formatClock(completionTime)}`)
        return { task, startTime, type: "start task", reason: "Reschedule: Could not find any available resource" }
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
      response = await axios.post(`${process.env.PROCESS_ENGINE}/engine-rest/external-task/${task.id}/complete`, body)
      if (response.status !== 204) throw new Error("could not complete task")
      logger.log("process", `Completing task ${task.activityId}at ${Common.formatClock(controller.clock)} with resoruce ${task.workerId}}`)
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
      if (!controller.taskMap[currTask.activityId]) {
        const newTask = new Activity({ activityId: currTask.activityId })
        await newTask.init()
        controller.taskMap[currTask.activityId] = newTask
      }
      //TODO: How should tasks be prioritized? Should new fetched evens be configured to run as soon as possible       
      let startTime = controller.taskMap[currTask.activityId].timing.before() + controller.clock
      controller.addEvent({ startTime, event: new Event({ task: { ...currTask, ...controller.taskMap[currTask.activityId] }, type: "start task" }) })
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
      const response = await axios.put(`${process.env.PROCESS_ENGINE}/engine-rest/external-task/${processInstanceId}/priority`, {
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