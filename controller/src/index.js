const axios = require('axios');
const { words } = require('lodash');
var moment = require('moment');
const { Event, PendingEvents, Worker, Common, ModelReader, Resource } = require('../src/helpers/index.js')
const Executor = {
  execute: async (controller) => {
    const messages = []

    while (controller.getPendingEventsLength() !== 0) {
      let { time, arr } = controller.popNextPendingEvent()
      const timestamp = moment.unix(time);
      messages.push("Executing event at time", timestamp.format("HH:mm:ss"))
      console.info("Executing event at time", timestamp.format("HH:mm:ss"))
      controller.setSimulationTime(time)
      while (arr.length !== 0) {
        const event = arr.pop()
        if (event.type === "start process") {
          const { data } = await Worker.startProcess({ event, controller })
          await Worker.fetchAndAppendNewTasks({ processInstanceId: data.id, controller })
          messages.push(" -- start process")
          console.log(" -- start process")
        }
        else if (event.type === "start task") {
          const { startTime, task, type } = await Worker.startTask({ task: event.task, controller, messages })
          controller.addEvent({ startTime, event: new Event({ task, type }) })           
        }
        else if (event.type === "complete task") {
          await Worker.completeTask({ ...event, controller })
          await Worker.fetchAndAppendNewTasks({ ...event.task, controller })
          console.log(" -- complete task")
          messages.push(" -- complete task")
        }
        else {
          throw new Error("could not read event type")
        }

      };
      controller.deleteEvent(time)
    }
    console.log(" -- simulation terminated")
    messages.push(" -- simulation terminated")
    return messages
  }
}


class Contoller {
  constructor({ processID, input }) {
    this.clock = Date.parse(input.startTime);
    this.pendingEvents = new PendingEvents()
    this.pendingEventsCopy = {}
    this.processID = processID
    this.resourceArr = [new Resource({ id: "walker" })]
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

        const frequencyAsSeconds = Common.isoToSeconds(frequency)
        for (let index = 0; index < amount; index++) {
          //First event in list always set at time zero (do not offset first event from clock init)
          startTime = Object.keys(this.pendingEvents) === 0 ? this.clock : startTime + frequencyAsSeconds
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

