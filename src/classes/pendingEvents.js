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
    addEvent({ timestamp, event}) {
      if(timestamp<1){
        throw new Error("timestamp must be greater than 1")
      }  
      let order = 0
      if (!this.events[timestamp]) {
        event.order = order
        this.events[timestamp] = [event]
      }
      else {
        const events = this.events[timestamp]
        // get order of last event and set order of new event accordingly


        // get all orders and then set the hightest
        if(events.length>0){
          let order = events.map(e=>e.order)
          order = order.sort(function(a,b) { return b - a; })[0]           
          event.order = order+1
        }
        events.push(event)
        // element with lowest order gets removed first                  
        // element with highest priority gets removed first         
        events.sort(function(a,b) { return b.order - a.order; });
        events.sort(function(a,b) { return a.priority - b.priority; });
      }
    }
  
    getEventsAt(timestamp) {
      return this.events[timestamp].events
    }
  
    delete(p) {
      delete this.events[p]
    }
  }
  
  exports.PendingEvents = PendingEvents; 