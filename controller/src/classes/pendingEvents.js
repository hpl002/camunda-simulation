var axios = require("axios").default;
var xml2js = require('xml2js');
var _ = require('lodash');
var parser = new xml2js.Parser();
var moment = require('moment');


class PendingEvents {
    constructor() {
      this.events = {};
    }
  
    /**
     * @param  {} {timestamp
     * @param  {} event}
     * add event at given timestamp
     * if there are any pre-existing events at the given timestamp then we add it to the array of events to happen at the given timestamp
     * events added to list with pre-existing events are effectively placed at bottom of list. 
     */
    addEvent({ timestamp, event }) {
      let order = 0
      if (!this.events[timestamp]) {
        event.order = order
        this.events[timestamp] = [event]
      }
      else {
        const events = this.events[timestamp]
        // get order of last event and set order of new event accordingly
        if(events.length>0) order = parseInt(events[events.length-1].order)+1 
        event.order = order

        events.push(event)
        // element with lowest order gets removed first
        events.sort((a, b) => { return b.order - a.order })
        // element with highest priority gets removed first
        events.sort((a, b) => { return a.priority - b.priority })
      }
    }
  
    getList() {
      return this.events
    }
  
    getEventsAt(timestamp) {
      return this.events[timestamp].events
    }
  
    delete(p) {
      delete this.events[p]
    }
  }
  
  exports.PendingEvents = PendingEvents; 