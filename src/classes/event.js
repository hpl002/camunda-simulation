class Event {
    constructor({ priority = -1, data = {}, type, task = {} }) {
        this.priority = priority;
        this.data = data;
        this.type = type;
        this.task = task;
    }
}


exports.Event = Event;