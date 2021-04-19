const moment = require('moment');
const axios = require('axios');
const { Event, PendingEvents, Worker } = require('./helper')



class Contoller {
  constructor({ processID, input }) {
    this.clock = Date.parse(input.startTime);
    this.pendingEvents = new PendingEvents()
    this.pendingEventsCopy = {}
    this.processID = processID
  }

  initPendingEvents({ tokens = [] }) {
    let startTime = this.clock;

    for (const token of tokens) {
      const { frequency, type, amount } = token.distribution
      // look at what type of distribution and add elements to list accordingly
      if (type.toUpperCase() === "CONSTANT") {
        const frequencyAsSeconds = moment.duration(frequency, moment.ISO_8601).asSeconds()
        for (let index = 0; index < amount; index++) {
          //First event in list always set at time zero (do not offset first event from clock init)
          startTime = Object.keys(this.pendingEvents) === 0 ? this.clock : startTime + frequencyAsSeconds
          this.pendingEvents.addEvent({ timestamp: startTime, event: new Event({ data: token.body, type: "start" }) })
        }
      }
      else {
        throw new Error("type not supported")
      }
    }
    const events = this.getPendingEvents()
    this.pendingEventsCopy = { ...events }
  }
  popNextPendingEvent() {
    const p = this.getPendingEvents()
    const keys = Object.keys(p)
    keys.sort((a, b) => { return b - a })
    const nextEventKey = keys.pop()
    const event = p[nextEventKey]
    this.pendingEvents.delete(nextEventKey)
    return { time: nextEventKey, arr: event }
  }

  async execute() {
    let keys = this.getPendingEvents()
    keys = Object.keys(keys)
    let promises
    for (const key of keys) {
      const { time, arr } = this.popNextPendingEvent()
      const timestamp = moment.unix(time);
      console.info("Executing event at time", timestamp.format("HH:mm:ss"))
      this.setSimulationTime(time)
      promises = arr.map(async event => {
        if (event.type === "start") {
          const responses = await this.startProcess(event, this.processID)
          return responses
        }
        else {
          throw new Error("could not read event type")
        }
      })
    }
    const r = await Promise.all(promises)
    return r;
  }

  setSimulationTime(pTime) {
    if (this.clock && pTime < this.clock) {
      throw new Error("simulation clock can only go forwards")
    } else {
      this.clock = pTime
    }
  };
  async startProcess(event, processID) {
    const basePath = process.env.PROCESS_ENGINE     
    const reqUrl = `${basePath}/engine-rest/process-definition/key/${processID}/start`
    try {
      const response = await axios.post(reqUrl, { ...event }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      return response
    } catch (error) {
      throw error
    }
  };
  getPendingEvents(copy = false) {
    if (copy) return this.pendingEventsCopy
    return this.pendingEvents.getList()
  };
}



exports.Controller = Contoller;
