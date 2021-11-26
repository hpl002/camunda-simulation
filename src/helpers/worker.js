var axios = require("axios").default;
const { Event } = require('../classes/Event')
const { Common } = require('./common')
const { logger } = require('../helpers/winston')
const appConfigs = require("../../config")
const { MathHelper } = require("./math")
const neo4j = require("../../controller/src/helpers/neo4j")
const _get = require("lodash.get")

const Worker = {
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
      return { data }
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
    const basePath = appConfigs.processEngine
    ///process-definition/key/{key}/start
    const reqUrl = `${basePath}/engine-rest/process-definition/key/${processKey}/start`
    // get variables on token
    let processData = controller.mergeVariablesAndUpdate({ event })
    processData.businessKey = "simulation-controller"
    try {
      const { data } = await axios.post(reqUrl, processData, {
        headers: {
          'Content-Type': 'application/json'
        }
      })
      logger.log("process", `starting process. Case: ${data.id}`)
      controller.tokenMap[data.id] = event.token.id
      await mongo.startEvent({ token_id: event.token.id, case_id: data.id, activity_id: "start", activity_start: Common.formatClock(controller.clock) })
      return data
    } catch (error) {
      console.error("failed while trying to start new process instance in camunda")
      throw error

    }
  },

  //--> update nodes in neo4j 

  updateNodesInNeo4j: async ({ query, driver, taskId, lockedUntil }) => {
    let modifiedQuery = query
    modifiedQuery.split("return nodes")[0]
    const modifiedQuery_taskId = `${modifiedQuery} SET nodes.taskId = ${taskId} return nodes`
    const modifiedQuery_lockedUntil = `${modifiedQuery} SET nodes.lockedUntil = ${lockedUntil} return nodes`

    // check that the records were indeed updated
    const records_taskId = await neo4j.executeQuery({ query: modifiedQuery_taskId, driver })
    records_taskId.records.forEach(element => {
      if (_get(element, "_fields[0].properties.taskId", false)) throw new Error("did not manage to successfully set taskId on nodes when marking as locked in neo4j ")
    });

    const records_lockedUntil = await neo4j.executeQuery({ query: modifiedQuery_lockedUntil, driver })
    records_lockedUntil.records.forEach(element => {
      if (_get(element, "_fields[0].properties.lockedUntil", false)) throw new Error("did not manage to successfully set lockedUntil on nodes when marking as locked in neo4j ")
    });
  },

  startTask: async ({ event, controller, mongo }) => {
    const driver = neo4j.init()
    const {camundaTask, task} = event
    const start = async ({ resources, completionTime }) => {
      try {
        let { variables } = controller.mergeVariablesAndUpdate({ event })
        if (Object.keys(variables).length > 0) await Common.refreshRandomVariables({ variables, processInstanceId: camundaTask.processInstanceId })
        const body = {
          "workerId": resources.join('-'),
          "lockDuration": 1800000
        }
        camundaTask.workerId = body.workerId

        //lock task with worker
        const { status } = await axios.post(`${appConfigs.processEngine}/engine-rest/external-task/${camundaTask.id}/lock`, body)
        if (status !== 204) throw new Error("could not lock task")
        //logger.log("process", `Starting task ${task.activityId} at ${Common.formatClock(controller.clock)} with resoruce ${task.workerId}}`)
        logger.log("process", `Starting task ${camundaTask.activityId} at ${Common.formatClock(controller.clock)}`)
        await mongo.startTask({ token_id: event.token.id, id: controller.runIdentifier, case_id: camundaTask.processInstanceId, activity_id: camundaTask.activityId, activity_start: Common.formatClock(controller.clock), resource_id: camundaTask.workerId })
        return {camundaTask, task, startTime: completionTime, type: "complete task" }
      } catch (error) {
        logger.log("error", error)
        throw error
      }
    }

    const addTaskDuration = ({ taskDuration, currentclock }) => {
      let res = currentclock
      if (taskDuration) {
        if (taskDuration.type === "constant") {
          const time = MathHelper.constant({ value: taskDuration.frequency })
          res = currentclock + time
        }
        else if (taskDuration.type === "normal distribution") {
          const time = MathHelper.normalDistribution({ ...taskDuration.frequency })
          res = currentclock + time
        }
        else if (taskDuration.type === "random") {
          const time = MathHelper.random({ ...taskDuration.frequency })
          res = currentclock + time
        }
      }
      return res
    }

    const accountForResources = async ({ driver, completionTime, controller, query = undefined, limit = undefined }) => {
      let type = undefined
      let res = completionTime

      // only bother with this is the task has a resource query a all
      if (query) {
        // if a limit has been set then this is appended to the query string
        if (limit) {
          query = `${query} LIMIT ${parseInt(limit)}`
        }
        const { records } = await neo4j.executeQuery({ query, driver })
        // array of all matched resoruces that are available
        const available = []
        // array of all matched resoruces that are unavailable
        const unavailble = []

        records.forEach(record => {
          const properties = _get(record, "_fields[0].properties", {})
          //if it does not have locked property then it is assumed to be available
          const isAvaialble = !!!properties.locked
          if (isAvaialble) {
            available.push(record)
          }
          else {
            unavailble.push(record)
          }
        });

        if (unavailble.length > 0) {
          type = "reschedule"
          let temp = 0

          unavailble.forEach(record => {
            // get time at which resource is available again
            const v = parseInt(_get(record, "_fields[0].properties.locked", undefined))
            if (v > temp) temp = v
          });
          res = temp

        } else {
          type = "schedule"
          //if there exists multiple resourecs then averate their efficiencies
          // if no efficiency is declared then assume this to be 100
          let sumEfficiency = undefined
          let resourceIds = []
          // check if resources have some assigned efficiency
          available.forEach(resource => {
            const id = _get(resource, "_fields[0].properties.id", undefined)
            if (!!!id) throw new Error("could not find id property on record returned from neo4j")
            resourceIds.push(id)
            let res = 100
            const resourceConfig = controller.input.resources && controller.input.resources.find(e => e.id === id)
            if (resourceConfig.efficiency) {
              const resourceEfficiency = resourceConfig.efficiency
              if (resourceEfficiency.type === "constant") {
                res = MathHelper.constant({ value: resourceEfficiency.frequency, iso: false })
              }
              else if (resourceEfficiency.type === "normal distribution") {
                res = MathHelper.normalDistribution({ ...resourceEfficiency.frequency, iso: false })
              }
              else if (resourceEfficiency.type === "random") {
                res = MathHelper.random({ ...resourceEfficiency.frequency, iso: false })
              }
            }
            sumEfficiency += res

          });
          //--> calculate new completion time
          // average efficiency by accounting for all resources
          sumEfficiency = sumEfficiency / available.length
          // get calcualted percentage of original value and add this to the original value
          res += parseInt(completionTime * (sumEfficiency / 100))

          await Worker.updateNodesInNeo4j({ driver, query, taskId: camundaTask.id, lockedUntil: res })
        }



        // are any of these resources occupied?(occuped resources have a property on the node itslef, same level as id)
        // are any of these resources occupied?
      }
      const permittedTypes = ["schedule", "reschedule"]
      if (!permittedTypes.includes(type)) throw new Error("tried to retur some invlid type from resource scheduler function")
      return { completionTime: res, resourceIds, type }

    }

    // add task duration if it is declared at all
    let completionTime = controller.clock
    if (task.timing) {
      completionTime = addTaskDuration({ taskDuration: task.timing, currentclock: controller.clock })
    }


    if (task["resource-query"]) {
      // account for resource unavailability or resource duration
      const res = await accountForResources({ limit: task["resource-query-limit"], query: task["resource-query"], driver, completionTime, controller })
      completionTime = res.completionTime
      if (res.type === "schedule") {
        // resources were available
        // resources are marked as occupied in neo4j with a refernce to this task
        // resource efficiency has also been accounted for if it exists for a given resource
        // resource with no explicit efficiency are assumed to work at 100 percent
        // if multiple resources then their efficiency is averaged
        // all retrieved nodes are locked
        return await start({ resources: res.resourceIds, completionTime })
      }
      else if (res.type === "reschedule") {
        // reschedule by adding a startTask event instead
        return { task, startTime: res.completionTime, type: "start task" }
      }
    }
    else {
      return await start({ resources: ["no-resource"], completionTime })
    }






  },

  completeTask: async ({ event, controller, mongo }) => {
    const driver = neo4j.init()
    const {task, camundaTask} = event
    // updating vals to null is the same as deleting them
    if(task["resource-query"]){
      await Worker.updateNodesInNeo4j({ driver, query: task["resource-query"], taskId: null, lockedUntil: null })
    }
    try {
      const body = {
        "workerId": camundaTask.workerId,
        "variables": {}
      }
      response = await axios.post(`${appConfigs.processEngine}/engine-rest/external-task/${camundaTask.id}/complete`, body)
      if (response.status !== 204) throw new Error("could not complete task")       
      logger.log("process", `Completing task ${camundaTask.activityId}at ${Common.formatClock(controller.clock)}`)
      await mongo.completeTask({ token_id: event.token.id, id: controller.runIdentifier, case_id: camundaTask.processInstanceId, activity_id: camundaTask.activityId, activity_end: Common.formatClock(controller.clock) })
    } catch (error) {
      logger.log("error", error.response.data.message)
      throw error
    }
  },

  fetchAndAppendNewTasks: async ({ processInstanceId, controller, mongo, token }) => {

    await Worker.checkIfProcessComplete({ processInstanceId, mongo, controller })

    //get tasks list from process engine. Filtered on the current process
    const tasks = await Worker.getTasks({ processInstanceId })
    if (tasks.length !== 0) logger.log("info", `fetching new tasks from Camunda. Found a total of ${tasks.length} new tasks`)
    while (tasks.length !== 0) {
      const currTask = tasks.pop()
      let startTime = controller.clock
      let t = {}
      if (controller.input.tasks) {
        t = controller.input.tasks.find(e => e.id === currTask.activityId)
      }
      controller.pendingEvents.addEvent({ timestamp: startTime, event: new Event({ token, camundaTask: currTask, task:t, type: "start task" }) })
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
    const { data } = await Worker.getHistory({ processInstanceId })
    if (data.state === "COMPLETED") {
      await mongo.endEvent({ token_id: controller.tokenMap[processInstanceId], case_id: data.id, activity_id: "end", activity_start: Common.formatClock(controller.clock) })
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