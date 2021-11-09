const { Event, Worker } = require('../src/helpers/index.js')
const { mongo } = require("./classes/Mongo")
const { Controller } = require('./helpers/controller') 

const Executor = {
  execute: async (controller) => {     
    while (controller.getPendingEventsLength() !== 0) {
      let { time, arr } = controller.popNextPendingEvent()       
      controller.setSimulationTime(time)
      while (arr.length !== 0) {
        const event = arr.pop()
        if (event.type === "start process") {
          const { id } = await Worker.startProcess({ event, controller, mongo })
          await Worker.fetchAndAppendNewTasks({ processInstanceId: id, controller, mongo })           
        }
        else if (event.type === "start task") {
          const data = await Worker.startTask({ task: event.task, controller, mongo })
          const { startTime, task, type } = data
          controller.addEvent({ startTime, event: new Event({ task, type }) })
        }
        else if (event.type === "complete task") {
          await Worker.completeTask({ ...event, controller, mongo })
          await Worker.fetchAndAppendNewTasks({ ...event.task, controller, mongo })           
        }
        else {
          throw new Error("could not read event type")
        }
      };
      controller.deleteEvent(time.toString())
    }
    console.log("terminated")
    return { "collection_identifier": controller.runIdentifier }
  }
}
exports.Executor = Executor;
exports.Controller = Controller;

