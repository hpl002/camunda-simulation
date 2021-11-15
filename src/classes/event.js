//add schema validation or jsdoc
class Event {
    constructor({ priority = -1, token = {}, type, task = {} }) {
        this.priority = priority;
        this.token = token;
        this.type = type;
        this.task = task;
    }
}


exports.Event = Event;