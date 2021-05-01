var axios = require("axios").default;
var xml2js = require('xml2js');
var _ = require('lodash');
var parser = new xml2js.Parser();
var moment = require('moment');
class Event {
  constructor({ priority = -1, data = {}, type, task = {} }) {
    this.priority = priority;
    this.data = data;
    this.type = type;
    this.task = task;
  }
}

class PendingEvents {
  constructor() {
    this.pendingEvents = {};
  }

  addEvent({ timestamp, event }) {
    if (!this.pendingEvents[timestamp]) {
      event.order = 0;
      this.pendingEvents[timestamp] = [event]
    }
    else {
      const events = this.pendingEvents[timestamp]
      event.order = events.length
      events.push(event)
      // element with lowest order gets removed first
      events.sort((a, b) => { return b.order - a.order })
      // element with highest priority gets removed first
      events.sort((a, b) => { return a.priority - b.priority })
    }
  }

  getList() {
    return this.pendingEvents
  }

  getEventsAt(timestamp) {
    return this.pendingEvents[timestamp].events
  }

  delete(p) {
    delete this.pendingEvents[p]
  }
}

const Worker = {

  getAttribute: ({ task, attributesMap, key }) => {
    let value = attributesMap[task.activityId]
    value = value.filter(e => e.name.toUpperCase() === key)
    return value?.[0]?.value
  },

  getDuration: ({ task, attributesMap }) => {
    const attr = Worker.getAttribute({ task, attributesMap, key: "DURATION" })
    if (attr) {
      return Common.isoToSeconds(attr)
    }
    else {
      return 0
    }
  },

  getWaiting: ({ task, attributesMap }) => {
    const attr = Worker.getAttribute({ task, attributesMap, key: "WAITING" })
    if (attr) {
      return Common.isoToSeconds(attr)
    }
    else {
      return 0
    }
  },

  calculateInsertionTime: ({ task, attributesMap, clock }) => {
    const duration = Worker.getWaiting({ task: task, attributesMap })
    return parseInt(clock) + duration
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
    const body = {}
    const { processID } = controller
    body.variables = event.data


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
    const startTime = Worker.calculateInsertionTime({ task, ...controller })
     

    let workerId = Worker.getAttribute({ task, ...controller, key: "RESOURCE" })
    let resource = controller.resourceMap[workerId]
    if (workerId && resource) {
      console.log("yay resource", resource)
    }
    if (!resource) workerId = "generic-worker"
    task.workerId = workerId

    /*
    
    resolve query against graph db and get resource identifier

    check if resource or resources are available:
    -  is resource locked, if so then when is the next time we can check for it
        - add event for checking for resource availability
    -  if not locked then check availability against timetable if this is defined
        - if not available then create event for checking once it becomes available again
    - if available then lock resource for set duration


    */
     
     


    try {
      const body = {
        "workerId": workerId,
        "lockDuration": 1800000
      }
      const response = await axios.post(`http://localhost:8080/engine-rest/external-task/${task.id}/lock`, body)
      if (response.status !== 204) throw new Error("could not lock task")
      return { task, startTime, type:"complete task" }
    } catch (error) {
      console.error(error);
      throw error
    }
  },

  completeTask: async ({ task }) => {

    /* 
      try to complete task by using the resource specified on task
    */



    try {
      const body = {
        "workerId": task.workerId,
        "variables": {}
      }
      const response = await axios.post(`http://localhost:8080/engine-rest/external-task/${task.id}/complete`, body)
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
      const timeStamp = Worker.calculateInsertionTime({ task: currTask, ...controller })
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

class ModelReader {
  constructor({ key }) {
    this.xml = {};
    this.js = {};
    this.attributes = {};
    this.key = key;
  }

  async getModel() {
    try {
      const response = await axios.get(`http://localhost:8080/engine-rest/process-definition/key/${this.key}/xml`)
      const { data, status } = response
      const { bpmn20Xml } = data
      if (status === 200) {
        this.xml = bpmn20Xml
      }
      else {
        throw new Error("could not get xml model from process engine")
      }
    } catch (error) {
      console.error(error)
      throw error
    }
  }


  async parseModel() {
    return parser.parseStringPromise(this.xml).then(function (result) {
      return result;
    }).catch((e) => {
      console.error(e)
      throw new Error("Failed while parsing xml string to js")
    })
  }


  generateAttributesMap() {
    const attributesMap = {}
    try {
      let activities = this.js["bpmn:definitions"]["bpmn:process"][0]
      Object.keys(activities).forEach(element => {
        if (!element.includes("bpmn")) delete activities[element]
      });

      const serviceTasks = activities["bpmn:serviceTask"]

      serviceTasks.forEach(element => {
        const id = _.find(element, function (o) { return o.name !== undefined; });
        attributesMap[id.id] = []
        let properties = _.get(element, 'bpmn:extensionElements[0].camunda:properties[0].camunda:property');
        if (Array.isArray(properties)) {
          properties.forEach(p => {
            const obj = _.find(p, function (o) { return o.name !== undefined; });
            attributesMap[id.id].push(obj)
          });
        }
      });
      return attributesMap
    } catch (error) {
      console.error(error)
      throw error
    }
  }


  async init() {
    await this.getModel()
    this.js = await this.parseModel()
    const r = this.generateAttributesMap()
    return r;
    // reads the xml model
    // parses out all activities in map 
  }
}

const Common = {
  isoToSeconds: (pISO) => {
    try {
      const r = moment.duration(pISO, moment.ISO_8601).asSeconds()
      if (!Number.isInteger(r)) {
        throw new Error(`could not parse time input to seconds. Expected input in the ISO_8601 format. Received ${pISO}`)
      }
      else {
        return r
      }
    } catch (error) {
      console.error(error)
      throw error
    }
  }
}


exports.Event = Event;
exports.PendingEvents = PendingEvents;
exports.Worker = Worker;
exports.ModelReader = ModelReader;
exports.Common = Common;
