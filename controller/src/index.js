const moment = require('moment');

class Event {
  constructor({ priority = -1, data = {} }) {
    this.priority = priority;
    this.data = data;
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


class Contoller {
  constructor({ startTime }) {
    this.clock = Date.parse(startTime);
    this.pendingEvents = new PendingEvents()
    this.pendingEventsCopy = {}
  }

  initPendingEvents({ tokens = [] }) {
    let startTime = this.clock;
    tokens.forEach(token => {
      const { frequency, type, amount } = token.distribution
      // look at what type of distribution and add elements to list accordingly
      if (type.toUpperCase() === "CONSTANT") {
        const frequencyAsSeconds = moment.duration(frequency, moment.ISO_8601).asSeconds()
        for (let index = 0; index < amount; index++) {
          //First event in list always set at time zero (do not offset first event from clock init)
          startTime = Object.keys(this.pendingEvents) === 0 ? this.clock : startTime + frequencyAsSeconds
          this.pendingEvents.addEvent({ timestamp: startTime, event: new Event({ data: token.body }) })
        }
      }
      else {
        throw new Error("type not supported")
      }
    });
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

  execute() {
    let keys = this.getPendingEvents()
    keys = Object.keys(keys)

    keys.forEach(key => {
      const { time, arr } = this.popNextPendingEvent()
      const timestamp = moment.unix(time);
      console.info("Executing event at time", timestamp.format("HH:mm:ss"))
      this.setSimulationTime(time)
      arr.forEach(event => {
        console.log("execute", event)
      });
    });

    /*
    1  - pop event from pendingevents list
    2  - update the simulation clock to this timestamp
    3  - pop each element from this list in order
    4  - when list is empty then get the timepoint of the events object and update the simulation clock to this    
    */
  }

  setSimulationTime(pTime) {
    if (this.clock && pTime < this.clock) {
      throw new Error("simulation clock can only go forwards")
    } else {
      this.clock = pTime
    }
  }

  getPendingEvents(copy = false) {
    if (copy) return this.pendingEventsCopy
    return this.pendingEvents.getList()
  }
}



exports.Controller = Contoller;
