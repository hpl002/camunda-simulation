var moment = require('moment');
const { Event, PendingEvents, Worker, Common, ModelReader, Resource } = require('../src/helpers/index.js')
const { Mongo } = require("./mongo/index.js")
const { v4: uuidv4 } = require('uuid');
const { logger } = require('./helpers/winston')
class Contoller {
  constructor({ processID, input }) {
    this.clock = Date.parse(input.startTime)
    this.readableTime = this.convertToReadableTime(Date.parse(input.startTime))
    this.pendingEvents = new PendingEvents()
    this.pendingEventsCopy = {}
    this.processID = processID
    this.resourceArr = []
    this.attributesMap = {}
    this.descriptionsMap = {}
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
    const modeler = new ModelReader({ key: this.processID })
    await modeler.init()
    this.attributesMap = await modeler.generateAttributesMap()
  }





  popNextPendingEvent() {
    const p = this.getPendingEvents()
    const keys = Object.keys(p)
    keys.sort((a, b) => { return b - a })
    const nextEventKey = keys.pop()
    const event = p[nextEventKey]
    //    this.pendingEvents.delete(nextEventKey)
    return { time: parseInt(nextEventKey), arr: event }
  }

  deleteEvent(key) {
    this.pendingEvents.delete(key)
  }

  setSimulationTime(pTime) {
    if (typeof pTime === "string") throw new Error("simulation time must be number")
    if (pTime < this.clock) {
      throw new Error("simulation clock can only go forwards")
    } else if (pTime > this.clock) {
      logger.log("info", `Updating simulation clock from ${this.readableTime.full} to  ${Common.formatClock(pTime)}`)
      this.readableTime = this.convertToReadableTime(pTime)
      this.clock = pTime
    }
  };

  convertToReadableTime(pTime) {
    const temp = {}
    temp.full = Common.formatClock(pTime)
    temp.week = Common.formatWeek(pTime)
    temp.day = Common.formatDay(pTime)
    temp.hour = Common.formatHour(pTime)
    return temp
  }

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