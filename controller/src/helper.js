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

  class Worker {
    constructor({ startTime }) {
      this.clock = Date.parse(startTime);
      this.pendingEvents = new PendingEvents()
      this.pendingEventsCopy = {}
    }
  }

  exports.Event = Event;
  exports.PendingEvents = PendingEvents;
  exports.Worker = Worker;