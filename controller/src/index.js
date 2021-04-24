const moment = require('moment');
const axios = require('axios');
const { Event, PendingEvents, Worker } = require('./helper')
const Executor = {
  execute: async () => {
    const arr = [1, 2, 3, 4, 5, 6, 111]

    while (arr.length > 0) {
      const s = arr.pop()
      try {
        const response = await axios.get(`https://jsonplaceholder.typicode.com/todos/${s}`)
        console.log(response.data.id);
      } catch (error) {
        console.log(error);
      }

    }

  },
  //const re = await axios.get(`https://jsonplaceholder.typicode.com/todos/${controller.getPendingEventsLength()}`)
  //console.log(re.data.id);
  execute2: async (controller) => {
    let sdd = []
    while (controller.getPendingEventsLength() !== 0) {
      console.log("controller.getPendingEventsLength()", controller.getPendingEventsLength())
      const { time, arr } = controller.popNextPendingEvent()
      const timestamp = moment.unix(time);
      console.info("Executing event at time", timestamp.format("HH:mm:ss"))
      controller.setSimulationTime(time)
      // change this to some other form of loop that pause execution
      while (arr.length !== 0) {
        const event = arr.pop()
        if (event.type === "start") {
          const response = await controller.startProcess(event, controller.processID)
          Worker.addTaskToEvents({response, controller})
           
          // worker queries the process engine for new task and adds this to existing pendingEvents map 
          
          // add function that pulls task api and filters on:
          //process id
           
          // generate completion link and add this to the new pendingEvents map
          // update the task itslef with a variable or flag that indicates that its already been processed


        }
        else {
          throw new Error("could not read event type")
        }
      };
    }
    return sdd
  }
}


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
    return axios.post(reqUrl, { ...event }, {
      headers: {
        'Content-Type': 'application/json'
      }
    })
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

