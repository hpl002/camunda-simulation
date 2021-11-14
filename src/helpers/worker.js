var axios = require("axios").default;
const { Event } = require('../classes/Event')
const { Activity } = require('../classes/Activity')
const { Common } = require('./common')
const { logger } = require('../helpers/winston')
const appConfigs = require("../../config")

const Worker = {
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
      const { data } = await axios.get(`${appConfigs.processEngine}/engine-rest/external-task?processInstanceId=${processInstanceId}&active=true&priorityHigherThanOrEquals=0`)
      return data
    } catch (error) {
      logger.log("error", error)
      throw error
    }
  },

  getHistory: async ({ processInstanceId }) => {
    //http://localhost:8080/engine-rest/history/process-instance/fb744ed8-454b-11ec-a122-0242ac1b0002
    try {
      const { data } = await axios.get(`${appConfigs.processEngine}/engine-rest/history/process-instance/${processInstanceId}`)
      return {data}
    } catch (error) {
      logger.log("error", error)
      throw error
    }
  },
  /**
   * @param  {} {event
   * @param  {} controller
   * @param  {} mongo}
   * starts new instance of process
   * https://docs.camunda.org/manual/7.5/reference/rest/process-definition/post-start-process-instance/
   */
  startProcess: async ({ event, controller, mongo }) => {
    const { processKey } = controller
    /* const variableKeys = Object.keys(event.data)
    //initialize the random variables needed
    variableKeys.forEach(key => {
      if (key.toUpperCase().includes("RANDOM")) {
        event.data[key].type = "integer"
        event.data[key].value = Math.round(Math.random() * 100)
      }
    }); */

    const basePath = appConfigs.processEngine
    ///process-definition/key/{key}/start
    const reqUrl = `${basePath}/engine-rest/process-definition/key/${processKey}/start`
    const processData = { variables: event && event.token && event.token.variables ? event.token.variables : {} }
    processData.businessKey = "simulation-controller"
    try {
      const { data } = await axios.post(reqUrl, processData, {
        headers: {
          'Content-Type': 'application/json'
        }
      })
      logger.log("process", `starting process. Case: ${data.id}`)
      controller.tokenMap[data.id] = event.token.id
      await mongo.startEvent({token_id:event.token.id, case_id: data.id, activity_id: "start", activity_start: Common.formatClock(controller.clock) })
      return data
    } catch (error) {
      console.error("failed while trying to start new process instance in camunda")
      throw error

    }
  },

  startTask: async ({ event, controller, mongo }) => {
    const Helper = {
      taskDuration: "task.timing.duration()",

      start: async ({ resources, completionTime }) => {
        try {
          //await Common.refreshRandomVariables({ task })
          //task.workerId = resources.join()
          const body = {
            "workerId": "task.workerId",
            "lockDuration": 1800000
          }

          //lock task with worker
          const { status } = await axios.post(`${appConfigs.processEngine}/engine-rest/external-task/${task.id}/lock`, body)
          if (status !== 204) throw new Error("could not lock task")
          //logger.log("process", `Starting task ${task.activityId} at ${Common.formatClock(controller.clock)} with resoruce ${task.workerId}}`)
          logger.log("process", `Starting task ${task.activityId} at ${Common.formatClock(controller.clock)}`)
          // check tokenMap
          // get key where value is task.processInstanceId
          //const tokenId = controller.getTokenId()
          await mongo.startTask({token_id: controller.tokenMap[task.processInstanceId] ,id: controller.runIdentifier, case_id: task.processInstanceId, activity_id: task.activityId, activity_start: Common.formatClock(controller.clock), resource_id: task.workerId })
          return { task, startTime: completionTime, type: "complete task" }
        } catch (error) {
          logger.log("error", error)
          throw error
        }
      },

      getResourcesWithSchedules: ({ specializationMap, hasSchedule }) => {
        const res = []
        Object.keys(specializationMap).forEach(element => {
          let r = specializationMap[element].filter(e => e.hasSchedule === hasSchedule)
          if (r.length > 0) res.push(r)
        });
        return res
      },

      /**
       * @param  {} {specializationMap
       * @param  {} hasSchedule}
       * return array of resources that have or do not have schedules
       */
      applyEfficiency: async ({ specializationResourceArr }) => {
        for (const key of Object.keys(specializationResourceArr)) {
          for (const r of specializationResourceArr[key]) {
            r.duration = r.duration + await r.efficiency({ time: Helper.taskDuration, options: { iso: false } })
          }
        }
      },

      applyScheduling: ({ specializationResourceArr }) => {
        Object.keys(specializationResourceArr).forEach(key => {
          specializationResourceArr[key].forEach(r => {
            r.duration = r.duration + r.addSchedulingTime({ clock: controller.clock, duration: Helper.taskDuration })
          });
        });
      },

      filterDuration: ({ specializationResourceArr }) => {
        Object.keys(specializationResourceArr).forEach(key => {
          specializationResourceArr[key] = specializationResourceArr[key].filter(e => e.duration !== undefined)
        });
      },

      sortDuration: ({ specializationResourceArr }) => {
        Object.keys(specializationResourceArr).forEach(key => {
          specializationResourceArr[key].sort((a, b) => a.duration > b.duration)
        });
      },

      verifyScheduling: ({ specializationResourceArr, task }) => {
        let elements = []
        Object.keys(specializationResourceArr).forEach(key => {
          if (task.specializationRequirement[key].requires > specializationResourceArr[key].length) elements.push(key)
        });
        if (elements.length > 0) throw new Error(`Applicable resources for task${task.activityId} ran of of scheduling. Missing resoruces in specialization(s):${elements.join()}`)
      },

      selectResources: ({ specializationResourceArr }) => {
        Object.keys(task.specializationRequirement).forEach(key => {
          //months.splice(months.length-2, months.length);
          const requirement = task.specializationRequirement[key].requires
          const length = specializationResourceArr[key].length
          specializationResourceArr[key].splice(requirement, length);

        });
      },

      allSpecializationsFilled: () => {
        let f = false
        Object.keys(task?.specializationRequirement).forEach(s => {
          f = !!filled[s].length
        });
        return f
      },

      /**
  * @param  {} {id
  * @param  {} task}
  * returns two objects, filled and not filled
  * filled consting of all specialziations that could be filled by a resource
  * notFilled consting of all specialziations that could not be filled by a resource
  */
      getAvailableResources: async ({ task, controller }) => {
        const response = {}
        response.potential = controller.resourceArr.filter(e => task.resourceCandidates.includes(e.id))
        let available = []


        task.resourceCandidates.forEach(resource => {
          const arr = controller.resourceArr.filter(e => e.id === resource && e.available === true)
          if (!!arr.length > 0) available.push(arr[0])
        });
        response.available = available

        return Helper.mapResourcesToRequirement({ ...response, task })
      },

      /**
     * @param  {} {available
     * @param  {} potential
     * @param  {} task}
     * returns two objects
     * one with all specializations that have been filled
     * one with specializations that have not been filled
     */
      mapResourcesToRequirement: ({ available, potential, task }) => {
        // map resources onto task requirement
        // missing resources are resources can execute the task but are not available
        const mappedResources = { ...task.specializationRequirement }
        const response = { filled: [], notFilled: [] }
        Object.keys(task.specializationRequirement).forEach(key => {
          const spentResources = []
          available.forEach(r => {
            if (r.specialization.includes(key) && !spentResources.includes(r.id)) {
              mappedResources[key].resources.push(r)
              spentResources.push(r.id)
              mappedResources[key].filled = mappedResources[key].requires === mappedResources[key].resources.length ? true : false
            }
          });
          if (mappedResources[key].filled === true) {
            response.filled[key] = [...mappedResources[key].resources]
          }
          else {
            response.notFilled[key] = [...mappedResources[key].resources]
          }
        });
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

      lockResource: ({ task, controller, specializationResourceArr }) => {
        let completionTime = 0
        let resources = []
        Object.keys(specializationResourceArr).forEach(key => {
          specializationResourceArr[key].forEach(r => {
            /* find index of first resource that matches id and update this */
            const index = controller.resourceArr.findIndex(e => e.id === r.id && e.available === true)
            if (index === -1) throw new Error("could not find any resource with the provided workerId")
            controller.resourceArr[index].task = task
            controller.resourceArr[index].available = false
            controller.resourceArr[index].lockedUntil = r.duration
            completionTime = r.duration > completionTime ? r.duration : completionTime
            resources.push(r.id)
            logger.log("process", `locking resource ${controller.resourceArr[index].id}(specialization:${key}) until ${Common.formatClock(r.duration)} on task ${task.activityId}`)
          });
        });
        return { completionTime, resources }
      }
    }


   



    //TODO: get 
    // filled being specializations which have been filled by a resource
    // not filled being specializaton which has not been filled by a resource
    /* let { filled, notFilled } = await Helper.getAvailableResources({ task, controller })

    let workerId = undefined
    let completionTime = 0
    let resources = [] */

    /*   if (!task.hasResourceCandidates) {
        // no resource no schedule
        workerId = "no-resource"
        completionTime = controller.clock + Helper.taskDuration
        return await Helper.start({ resources: [workerId], completionTime })
      }
      else {
        if (Helper.allSpecializationsFilled()) {
          await Helper.applyEfficiency({ specializationResourceArr: filled })
          const resourcesWithSchedules = Helper.getResourcesWithSchedules({ specializationMap: filled, hasSchedule: true })
          const resourcesWithoutSchedules = Helper.getResourcesWithSchedules({ specializationMap: filled, hasSchedule: false })
          if (!!resourcesWithSchedules.length === !!resourcesWithoutSchedules.length) throw new Error("Task cannot have resources with and without schedules. These are mutually exclusive")
          //account for resource schedules
          if (!!resourcesWithSchedules.length) {
            Helper.applyScheduling({ specializationResourceArr: filled })
            Helper.filterDuration({ specializationResourceArr: filled })
            Helper.verifyScheduling({ specializationResourceArr: filled, task })
          }
          Helper.sortDuration({ specializationResourceArr: filled, task })
          Helper.selectResources({ specializationResourceArr: filled })
  
          const r = Helper.lockResource({ task, controller, specializationResourceArr: filled })
          return await Helper.start({ ...r })
        }
        else {
          // TODO: pass in array. Functions finds earliest time at which all resources are available
          const startTime = await Helper.howLongUntilResourceAvailable({ potential, controller })
          logger.log("process", `Found resource on task and resources is not available. Rescheduling to ${Common.formatClock(completionTime)}`)
          return { task, startTime, type: "start task", reason: "Reschedule: Could not find any available resource" }
        }
      } */

      const task = event.task     
     
      const workerId = "no-resource"
      //const completionTime = controller.clock + Helper.taskDuration
      const completionTime = controller.clock
      return await Helper.start({ resources: [workerId], completionTime })

  },

  completeTask: async ({ event, controller, mongo }) => {
    const task = event.task
    // check that resources are indeed available
    if (task.workerId && task.workerId !== "no-resource") {
      Worker.freeResource({ task, controller })
    }
    try {
      const body = {
        "workerId": "task.workerId",
        "variables": {}
      }
      response = await axios.post(`${appConfigs.processEngine}/engine-rest/external-task/${task.id}/complete`, body)
      if (response.status !== 204) throw new Error("could not complete task")
      //logger.log("process", `Completing task ${task.activityId}at ${Common.formatClock(controller.clock)} with resoruce ${task.workerId}}`)
      logger.log("process", `Completing task ${task.activityId}at ${Common.formatClock(controller.clock)}`)       
      await mongo.completeTask({token_id: controller.tokenMap[task.processInstanceId], id: controller.runIdentifier, case_id: task.processInstanceId, activity_id: task.activityId, activity_end: Common.formatClock(controller.clock) })
    } catch (error) {
      logger.log("error", error.response.data.message)
      throw error
    }
  },

  fetchAndAppendNewTasks: async ({ processInstanceId, controller, mongo }) => {

    await Worker.checkIfProcessComplete({ processInstanceId, mongo, controller })         

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

      let startTime = controller.clock
      controller.pendingEvents.addEvent({ timestamp: startTime, event: new Event({ task: { ...currTask, ...controller.taskMap[currTask.activityId] }, type: "start task" }) })
      await Worker.setPriority({ processInstanceId: currTask.id })
    }
  },
  /**
   * @param  {} {processInstanceId
   * @param  {} controller}
   * Check if process is complete. If complete then we a event to signal this
   */
  checkIfProcessComplete: async ({ processInstanceId, controller, mongo }) => {
    //get tasks list from process engine. Filtered on the current process
    const {data} = await Worker.getHistory({ processInstanceId })
    if (data.state === "COMPLETED") {       
      await mongo.endEvent({token_id:controller.tokenMap[processInstanceId], case_id: data.id, activity_id: "end", activity_start: Common.formatClock(controller.clock) })
    }
  },

  /**
   * @param  {} {processInstanceId}
   * force a negative priority on taks so that it does not show when pulling new tasks
   * this is used as a mechanism to ensure that we do not register the same pending task multiple times
   */
  setPriority: async ({ processInstanceId }) => {
    try {
      const response = await axios.put(`${appConfigs.processEngine}/engine-rest/external-task/${processInstanceId}/priority`, {
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