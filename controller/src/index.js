var moment = require('moment');
const { Event, PendingEvents, Worker, Common, ModelReader, Resource } = require('../src/helpers/index.js')
const { Mongo } = require("./mongo/index.js")
const { v4: uuidv4 } = require('uuid');
const Executor = {
  execute: async (controller) => {
    const runIdentifier = uuidv4()
    const mongo = new Mongo({ collection: runIdentifier })
    while (controller.getPendingEventsLength() !== 0) {
      let { time, arr } = controller.popNextPendingEvent()
      let timestamp = moment(parseInt(time)).format("YYYY-MM-DD HH:mm:ss")
      controller.setSimulationTime(time)
      while (arr.length !== 0) {
        const event = arr.pop()
        if (event.type === "start process") {
          const { data } = await Worker.startProcess({ event, controller })
          await Worker.fetchAndAppendNewTasks({ processInstanceId: data.id, controller })
          await mongo.add({ case_id: data.id, activity_id: "start", activity_start: timestamp, activity_end: timestamp, activity_type: "start" })
        }
        else if (event.type === "start task") {
          const data = await Worker.startTask({ task: event.task, controller })
          const { startTime, task, type } = data
          await mongo.add({ case_id: task.processInstanceId, activity_id: task.activityId, activity_start: timestamp, resource_id: task.workerId })
          controller.addEvent({ startTime, event: new Event({ task, type }) })
        }
        else if (event.type === "complete task") {
          await Worker.completeTask({ ...event, controller })
          const { task } = event

          await mongo.add({ case_id: task.processInstanceId, activity_id: task.activityId, activity_end: timestamp, resource_id: task.workerId })
          await Worker.fetchAndAppendNewTasks({ ...event.task, controller })
        }
        else {
          throw new Error("could not read event type")
        }

      };
      controller.deleteEvent(time)
    }
    return { "collection_identifier": runIdentifier }
  }
}


class Contoller {
  constructor({ processID, input }) {
    this.clock = Date.parse(input.startTime);
    this.pendingEvents = new PendingEvents()
    this.pendingEventsCopy = {}
    this.processID = processID
    this.resourceArr = [new Resource({ id: "walker" }), new Resource({ id: "walker" })]
    this.attributesMap = {}
  }

  addEvent({ startTime, event }) {
    this.pendingEvents.addEvent({ timestamp: startTime, event: event })
  }

  initPendingEvents({ tokens = [] }) {
    let startTime = this.clock;
    for (const token of tokens) {
      const { frequency, type, amount } = token.distribution
      // look at what type of distribution and add elements to list accordingly
      if (type.toUpperCase() === "CONSTANT") {

        const frequencyAsSeconds = Common.isoToMilliseconds(frequency)
        for (let index = 0; index < amount; index++) {
          //First event in list always set at time zero (do not offset first event from clock init)
          if (Object.keys(this.pendingEvents.pendingEvents).length === 0) {
            startTime = this.clock
          }
          else {
            startTime = startTime + frequencyAsSeconds
          }
          this.addEvent({ startTime: startTime, event: new Event({ data: token.body, type: "start process" }) })
        }
      }
      else {
        throw new Error("type not supported")
      }
    }
    const events = this.getPendingEvents()
    this.pendingEventsCopy = { ...events }
  }




  async init({ tokens = [] }) {
    this.initPendingEvents({ tokens })
    await this.initAttributesMap()

  }


  async initAttributesMap() {
    const modeler = new ModelReader({ key: this.processID })
    this.attributesMap = await modeler.init()
  }


  popNextPendingEvent() {
    const p = this.getPendingEvents()
    const keys = Object.keys(p)
    keys.sort((a, b) => { return b - a })
    const nextEventKey = keys.pop()
    const event = p[nextEventKey]
    //    this.pendingEvents.delete(nextEventKey)
    return { time: nextEventKey, arr: event }
  }

  deleteEvent(key) {
    this.pendingEvents.delete(key)
  }

  setSimulationTime(pTime) {
    if(typeof pTime === "String") throw new Error("simulation time must be number")
    if (this.clock && pTime < this.clock) {
      throw new Error("simulation clock can only go forwards")
    } else {
      this.clock = pTime
    }
  };

  getPendingEvents(copy = false) {
    if (copy) return this.pendingEventsCopy
    return this.pendingEvents.getList()
  };

  getPendingEventsLength(copy = false) {
    if (copy) return this.pendingEventsCopy
    const obj = this.pendingEvents.getList()
    return Object.keys(obj).length
  };
}





exports.Controller = Contoller;
exports.Executor = Executor;

