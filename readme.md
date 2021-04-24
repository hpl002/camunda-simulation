# todo

## Problem
1. external worker and controller can go out of sync
   1. controller moves too fast
      1. updates simulation clock and starts new process before the process engine has had time to process it and the worker has had time to add it to pendingEvents queue
   2. fire event and then wait until its next event has been registered by worker and added to queue or proceed if it has ended


 
event requests need to be triggered in the loop
 - trigger start event
 - wait for its next event

## high level algo

0 - generate list of initial start events (these events are added to the pendingEvents map)

1 - pop element from pendingEvents map
    2.1 set the simulation clock to the timestamp of this event
        pendingEvents is a map structure of events
            the key being the point in time
            the value being an array of event objects
            each event object has a type, data, and priority attribute
                the type determening how it should be handled
                the data being data that is used in execution, for example when spawning a new token in the event of start event (type==="start")
                the priority determening how it should be ordered in the list
                    the default ordering being -1 for all events
                    events which should jump furter up list should be assigned a priority accordingly
2 - pop firt event from the sorted events list
3 - execute this event
4 - external worker queries the REST task api repeatedly until it registeres this event (meaning that the process engine has finished processing it)
    4.1 if the process has terminated then we signal the controller that there is no new event to add and that it can continue
5 - external worker adds this new task as an event in the pendingsEvents map
6 - controller progresses to next event
7 - if there are no new events in list then we pop attempt to loop
8 - if there are no more elements in map then terminate simulation
    
## post processing og event log
While the simulation is executing it generated a log. However, this log is not in sync with the simulation clock and therefore needs to be processed further to reflect this.
While executing we are logging additional information and variables that can be used to determine the actual simulation time for each event. 
Through post-processing we are able to convert the timing information from real-time to simulation time