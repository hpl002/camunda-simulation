var axios = require("axios").default;
var xml2js = require('xml2js');
var _ = require('lodash');
var parser = new xml2js.Parser();
var moment = require('moment');


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
  
  exports.PendingEvents = PendingEvents; 