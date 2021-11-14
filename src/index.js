const { Event, Worker } = require('../src/helpers/index.js')
/*

Loop which iterates as long as there are envents to be executed

The list grows as new events are pulled from camunda
- at initiation we only have the timestamp of the start event. 
- The list is populated as time goes on


Basic algorithm:
 - get the "next" event that is set to occur from controller
   - get object from controller consisting of a timestamp and a array of events set to occur at this timestamp(1-n events)
   - every event in this list is executed


Sorting strategies:
 - these determine the ordering of events

 Strategy 1
  - events are queued according to the order they are received from camunda

 Strategy 2 (start process first)

 Strategy 3 (start activity first)

 Strategy 4 (end activity first)

 Strategy 5 (activity priority)
  - try to either start or end specific events

  Strategy 6 (activity priority)
  - try to either start or end specific events that use some specific resource

  


 - Events should be ordered according to a set sorting strategy
  - are there certain events that should be prioritized?
     - some acitivities which should always be performed first?


*/
const Executor = {
  execute: async ({ controller, mongo }) => {
    while (Object.keys(controller.pendingEvents.events).length !== 0) {
      let { time, arr } = controller.popNextPendingEvent()
      controller.setSimulationTime(time)
      while (arr.length !== 0) {
        const event = arr.pop()
        if (event.type === "start process") {
          const { id } = await Worker.startProcess({ event, controller, mongo })
          await Worker.fetchAndAppendNewTasks({ processInstanceId: id, controller, mongo })
        }
        else if (event.type === "start task") {
          const data = await Worker.startTask({ event, controller, mongo })           
          const { startTime, task, type } = data
          controller.pendingEvents.addEvent({ timestamp: startTime, event: new Event({ task, type }) })
        }
        else if (event.type === "complete task") {
          await Worker.completeTask({ event, controller, mongo })
          await Worker.fetchAndAppendNewTasks({ ...event.task, controller, mongo })
        }
        else {
          throw new Error("could not read event type")
        }
      };
      delete controller.pendingEvents.events[time.toString()]
    }
    console.log("terminated")
  }
}
exports.Executor = Executor;
