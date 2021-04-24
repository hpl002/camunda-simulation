var axios = require("axios").default;
var xml2js = require('xml2js');
var _ = require('lodash');
var parser = new xml2js.Parser();
class Event {
  constructor({ priority = -1, data = {}, type }) {
    this.priority = priority;
    this.data = data;
    this.type = type;
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

  calculateInsertionTime: async () => {
    // get task variables and such
    // calculate when the task is set to execute
  },

  addTaskToEvents: async ({ response, controller }) => {
    const { data } = response
    const tasks = await getTasks({ processInstanceId: data.id })

    while (tasks.length != 0) {
      const currTask = tasks.pop()
      const timeStamp = await calculateInsertionTime()

    }

    // get all taks whice hav enot been flagged
    // add tasks to pendingEvents map
    // flag task with priority such that it is omitted in next query

  },

  getTasks: async ({ processInstanceId }) => {
    var options = {
      method: 'get',
      url: `http://localhost:8080/engine-rest/external-task?processInstanceId=${processInstanceId}&active=true&priorityHigherThanOrEquals=0`,
      headers: {}
    };

    try {
      const { data } = await axios.request(options)
      return data
    } catch (error) {
      console.error(error);
      throw error
    }
  },

  setPriority: async ({ processInstanceId }) => {

    var data = JSON.stringify({
      "priority": -1
    });

    var options = {
      method: 'put',
      url: `http://localhost:8080/engine-rest/external-task/${processInstanceId}/priority`,
      headers: {
        'Content-Type': 'application/json'
      },
      data: data
    };

    try {
      const { status } = await axios.request(options)
      if (status !== 204) throw new Error("could not update status on task")
    } catch (error) {
      console.error(error);
      throw error
    }


  },

}

class ModelReader {
  // class which parses the bpmn diagram and extracts the different activity attributes
  // these attributes are then used to calculate the different durations, etc.
  constructor({ key }) {
    this.xml = {};
    this.js = {};
    this.attributes = {};
    this.key = key;
  }

  async getModel() {
    var options = {
      method: 'GET',
      url: `http://localhost:8080/engine-rest/process-definition/key/${this.key}/xml`,
    };

    try {
      const response = await axios.request(options)
      const { data, status } = response
      const { bpmn20Xml } = data
      if (status === 200) {
        this.xml = bpmn20Xml
      }
      throw new Error("could not get xml model from process engine")
    } catch (error) {
      console.error(error)
      throw error
    }
  }


  async parseModel() {     
    parser.parseStringPromise(this.xml).then(function (result) { 
      console.log("length", Object.keys(result).length)
      return result;
    }).catch((e)=>{
      console.error(e)
      throw new Error("Failed while parsing xml string to js")
    })
  }


  generateAttributesMap() {
    try {
      this.js["bpmn:definitions"]["bpmn:process"][0]
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
    await this.parseModel()
    // reads the xml model
    // parses out all activities in map 
  }
}


exports.Event = Event;
exports.PendingEvents = PendingEvents;
exports.Worker = Worker;
exports.ModelReader = ModelReader;
