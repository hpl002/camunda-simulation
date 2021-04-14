const moment = require('moment');



class PendingEvent {
    constructor(time, event) {
      this.time = time;
      this.events = [event];
    }
    //write function for adding token
    //list is always sorted by time in accending order such that we can pop()
    //
  }

  class Event {
    constructor(priority = -1, description) {
      this.priority = priority;
      this.description = description;
    }     
  }

const pendingEvents = [];


var clock = ""; 

const contoller = {
    /**
     * @param  {} {startTime
     * @param  {} tokens}
     * Take the token input and generate a list of pending start events
     */
    initPendingEvents : ({startTime, tokens = []}) => {
        // set clock by converting from iso 8601 to unix time
        clock = Date.parse(startTime);
        tokens.forEach(token => {
            // look at what type of distribution and add elements to list accordingly0
            const {frequency} = token.distribution             
            var durationAsSeconds = moment.duration(frequency, moment.ISO_8601).asSeconds()
            console.log(durationAsSeconds)

            //convert frequency to seconds
        });


         
        
        return 'Jim';
    },
    getSimulationTime : () => {
        return clock ;
    },
    getPendingEvents : () => {
        return pendingEvents;
    }
}


  
  exports.controller = contoller;
  