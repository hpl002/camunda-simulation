const { compareAsc, format } = require("date-fns")



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
        clock = date.parse(startTime);
        tokens.forEach(token => {
            // look at what type of distribution and add elements to list accordingly0
            console.log(token.distribution.frequency)
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
  