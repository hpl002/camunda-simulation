# deps

# updating the history with simulation times
 - need to update all realtime timepoints with simulation times in order make it work with camunda optimize
 - this can hopefully be solved via some slightly clever triggers..
## tables (all history tables)
 - variables(created time)
   - variables are used as a mechanism for pusing simulation relevant timestamps into the database
   - these variables have no impact on actual routing in the process and should therfore be eliminated once their values have been extracted in the db
 - process instance(sart, end, duration)
 - ext task log(timestamp)
 - detail(time)
 - actInst(start time, end time, duration)


## issues
 - in what order are the history tables populated?
 - using triggers migth make this a bit complicated as we have no idea if related data is availabel in other tables at the required point in time

## solution
 - create a script that manages this for us
 - 


fffffffff
 - figuring out the relations is not that hard but writing triggers and db jobs in sql eats too much time
 - this in turn means that the camunda optimze integration will have to wait for another time

In the meantime we can create our own simplistic event log
 - the event log requires
 - activity id
 - start time
 - end time
 - resource id

optional
 - resource description
 - activity description
 - cost
 - blabla


## Camunda
REST api - https://docs.camunda.org/manual/7.5/reference/rest/

## H2 in-memory db
localhost:8080/h2-console 
JDBC URL: jdbc:h2:./camunda-h2-default/process-engine


# todo
 - have a look at the h2 database
 - here we want to update the runtime start and end times with the relevant simulation times
 - effectively replacing the run time timepstamps with those from the simulation

ACT_RU_*: RU stands for runtime. These are the runtime tables that contain the runtime data of process instances, user tasks, variables, jobs, etc. The engine only stores the runtime data during process instance execution and removes the records when a process instance ends. This keeps the runtime tables small and fast.

TODO: create a db trigger that runs whenever a new entry is added to the runtime table. This then fetched the new simulation time from process variable and replaces it
 - initial test: create a simple trigger that just appends some random data


tigger:
 - on insert check event type
 - grab the correct variable and update row
 - drop the variable

## Problem
 

 

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