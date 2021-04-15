const moment = require('moment');




class Event {
  constructor({priority = -1, description}) {
    this.priority = priority;
    this.description = description;
  }
}


class Contoller {
  constructor({startTime}) {
    this.clock = Date.parse(startTime);
    this.pendingEvents = {};
  }

  initPendingEvents({ tokens = [] }) {
    let startTime = this.clock;

    tokens.forEach(token => {
      const { frequency, type, amount } = token.distribution
      // look at what type of distribution and add elements to list accordingly
      if (type.toUpperCase() === "CONSTANT") {
        const frequencyAsSeconds = moment.duration(frequency, moment.ISO_8601).asSeconds()
        for (let index = 0; index < amount; index++) {
          this.pendingEvents[startTime] = new Event({description: "description yo"})
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
