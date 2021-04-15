const moment = require('moment');

class Event {
  constructor({ priority = -1, description = "" }) {
    this.priority = priority;
    this.description = description;
  }
}

class PendingEvents {
  constructor() {
    this.pendingEvents  = {};
  }

  addEvent({ timestamp, event }) {
    if (!this.pendingEvents[timestamp]) {
      event.order=0;
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

  popEvent() {
    return this.pendingEvents[timestamp]
  }
}


class Contoller {
  constructor({ startTime }) {
    this.clock = Date.parse(startTime);
    this.pendingEvents = new PendingEvents()
  }

  initPendingEvents({ tokens = [] }) {
    let startTime = this.clock;

    tokens.forEach(token => {
      const { frequency, type, amount } = token.distribution
      // look at what type of distribution and add elements to list accordingly
      if (type.toUpperCase() === "CONSTANT") {
        const frequencyAsSeconds = moment.duration(frequency, moment.ISO_8601).asSeconds()
        for (let index = 0; index < amount; index++) {
          this.pendingEvents.addEvent({ timestamp: startTime, event: new Event({ description: "description yo" }) })
          startTime = startTime + frequencyAsSeconds
        }
      }
      else {
        throw new Error("type not supported")
      }
    });
  }

  getSimulationTime() {
    return this.clock
  }

  getPendingEvents() {
    return this.pendingEvents;
  }
}



exports.Controller = Contoller;
