const { Event, PendingEvents, Common, Resource } = require('./index.js')
const { logger } = require('./winston')
const { MathHelper } = require('./math')

module.exports = {
  Controller: class {
    constructor({ startTime, runIdentifier, processKey }) {
      this.processKey = processKey
      this.clock = Date.parse(startTime)
      this.readableTime = Common.convertToReadableTime(Date.parse(startTime))
      this.pendingEvents = new PendingEvents()
      //this.pendingEventsCopy = {}
      this.resourceArr = []
      this.runIdentifier = runIdentifier
      this.descriptionsMap = {}
      this.taskMap = {}
      this.tokenMap = {}
    }

    /**
     * @param  {} {tokens=[]}
     * init list of start events
     * First event in list always set at time zero (do not offset first event from clock init)
     */
    initPendingEvents({ tokens = [] }) {
      let startTime = this.clock;
      for (const token of tokens) {
        const { id, variables, amount, distribution } = token
        const { type } = distribution


        if (type == "constant") {
          const { frequency } = distribution
          for (let index = 0; index < amount; index++) {
            if (Object.keys(this.pendingEvents.events).length === 0) {
              startTime = this.clock
            }
            else {
              startTime = startTime + MathHelper.constant({ value: frequency })
            }
            this.pendingEvents.addEvent({ timestamp: startTime, event: new Event({ token:token, type: "start process", originatingToken: id }) })
          }
        }
        /*       else if (type.toUpperCase() === "NORMALDISTRIBUTION") {
                for (let index = 0; index < amount; index++) {
                  //First event in list always set at time zero (do not offset first event from clock init)
                  if (Object.keys(this.pendingEvents.events).length === 0) {
                    startTime = this.clock
                  }
                  else {
                    startTime = startTime + MathHelper.normalDistribution({ mean: frequency.mean, sd: frequency.sd })
                  }
                  this.addEvent({ startTime: startTime, event: new Event({ data: token.body, type: "start process" }) })
                }
              }
        
                  else if (type.toUpperCase() === "BERNOULLI") {                  
                    for (let index = 0; index < amount; index++) {
                      //First event in list always set at time zero (do not offset first event from clock init)
                      if (Object.keys(this.pendingEvents.events).length === 0) {
                        startTime = this.clock
                      }
                      else {
                        startTime = startTime + MathHelper.bernoulli({value:frequency, iso:false})
                      }
                      this.addEvent({ startTime: startTime, event: new Event({ data: token.body, type: "start process" }) })
                    }
                  } 
        
              else if (type.toUpperCase() === "POISSON") {
                for (let index = 0; index < amount; index++) {
                  //First event in list always set at time zero (do not offset first event from clock init)
                  if (Object.keys(this.pendingEvents.events).length === 0) {
                    startTime = this.clock
                  }
                  else {
                    startTime = startTime + MathHelper.poisson({ value: frequency })
                  }
                  this.addEvent({ startTime: startTime, event: new Event({ data: token.body, type: "start process" }) })
                }
              }
        
              else if (type.toUpperCase() === "RANDOM") {
                for (let index = 0; index < amount; index++) {
                  //First event in list always set at time zero (do not offset first event from clock init)
                  if (Object.keys(this.pendingEvents.events).length === 0) {
                    startTime = this.clock
                  }
                  else {
                    startTime = startTime + MathHelper.random({ min: frequency.min, max: frequency.max })
                  }
                  this.addEvent({ startTime: startTime, event: new Event({ data: token.body, type: "start process" }) })
                }
              } */
      }
      //const events = this.getPendingEvents()
      //this.pendingEventsCopy = { ...events }
    }

    async init({ tokens = [] }) {
      this.initPendingEvents({ tokens })
      //this.pendingEvents.events
      //this.attributesMap = await modeler.generateAttributesMap()
      //await this.initResourceArr()
    }

    async initResourceArr() {
      // make request to check if neo instance is even configured
      const query = "MATCH (r:Resource) return r"
      let resources = await executeQuery({ query })
      resources = resources.map(e => e.get("r"))
      resources = resources.map(e => e.properties.id)


      for (const resource of resources) {
        const newResource = new Resource({ id: resource })
        await newResource.init()
        this.resourceArr.push(newResource)
      }
    }

    getProcessIdFromTokenId(id) {
      Object.keys(this.tokenMap).forEach(key => {
        if (this.tokenMap[key] === id) return key
      });



    }

    popNextPendingEvent() {
      // get map of all pending events
      const pending = this.pendingEvents.events
      // keys are timestamps
      const keys = Object.keys(pending)
      // sort all keys from first to last(smallest to largest value)
      keys.sort((a, b) => { return b - a })
      // get head of list
      const nextEventKey = keys.pop()
      // set current event as this event
      const event = pending[nextEventKey]
      //    this.pendingEvents.delete(nextEventKey)
      // returns timestamd and array of all evenents which are set to occur at this time
      return { time: parseInt(nextEventKey), arr: event }
    }

    setSimulationTime(pTime) {
      if (typeof pTime === "string") throw new Error("simulation time must be number")
      if (pTime < this.clock) {
        throw new Error("simulation clock can only go forwards")
      } else if (pTime > this.clock) {
        logger.log("process", `Updating simulation clock from ${this.readableTime.full} to  ${Common.formatClock(pTime)}`)
        this.readableTime = Common.convertToReadableTime(pTime)
        this.clock = pTime
      }
    };
  }
}
