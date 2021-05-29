const { Resource } = require('../src/classes/resource')
var _ = require('lodash');
var chai = require('chai');
var assert = chai.assert;
const hourasseconds = 3600000




const lisa = new Resource({ id: "Lisa" })
const john = new Resource({ id: "John" })
const resources = [lisa, john]

const setDefault = ({ type }) => {
    //schedule or schedule-gaps
    resources.forEach(resource => {
        resource.hasSchedule = true
        var { schedule } = require(`./data/${type}`);
        resource.schedule = schedule
        resource.available = true
    });
}





describe('Find duration between end of current shift and start of next', () => {
    it('Should find the duration from end of current shift to start of next shift the following day', async () => {
        setDefault({type:"schedule"})
        const week = 21
        const day = "Monday"
        const currentEnd = 1621861200000
        const next = _.get(lisa.schedule, `21.Tuesday`)
        const nextStart = 1621918800000
        const time = lisa.timeFromEndOfCurrentToStartOfNext({ week, day })
        assert.equal(time, nextStart - currentEnd);
    })

    it('Should find the duration from end of current shift to start of next shift the following week', async () => {
        setDefault({type:"schedule-gaps"})
        const week = 21
        const day = "Saturday"
        const currentEnd = lisa.schedule["21"]["Saturday"].end.epoch
        const nextStart = lisa.schedule["22"]["Thursday"].start.epoch         
        const time = lisa.timeFromEndOfCurrentToStartOfNext({ week, day })
        assert.equal(time, nextStart - currentEnd);
    })
})



describe('Find next scheduled shift', () => {     
    it('Should find the scheduled shift, the following day', async () => {
        setDefault({type:"schedule"})
        const week = 21
        const day = "Monday"
        const next = _.get(lisa.schedule, `21.Tuesday`)
        const { start, end } = lisa.findNextShift({ week, day })
        assert.equal(next.start, start);
        assert.equal(next.end, end);
    })

    it('Should find the scheduled shift but using a different starting point, the following day', async () => {
        setDefault({type:"schedule"})
        const week = 21
        const day = "Thursday"
        const next = _.get(lisa.schedule, `21.Friday`)
        const { start, end } = lisa.findNextShift({ week, day })
        assert.equal(next.start, start);
        assert.equal(next.end, end);
    })

    it('Should find the scheduled shift but now uses a schedule with gaps', async () => {
        setDefault({type:"schedule-gaps"})
        const week = 21
        const day = "Tuesday"
        const next = _.get(lisa.schedule, `21.Friday`)
        const { start, end } = lisa.findNextShift({ week, day })
        assert.equal(next.start, start);
        assert.equal(next.end, end);
    })

    it('Should find the scheduled shift but now uses a schedule with gaps and multiple weeks', async () => {
        setDefault({type:"schedule-gaps"})
        const week = 21
        const day = "Saturday"
        const next = _.get(lisa.schedule, `22.Thursday`)
        const { start, end } = lisa.findNextShift({ week, day })
        assert.equal(next.start, start);
        assert.equal(next.end, end);
    })

    it('Should return the following shift by specifying todays shift', async () => {
        setDefault({type:"schedule"})
        const week = 21
        let { start, end } = lisa.findNextShift({ week, day: "Monday" })
        let next = _.get(lisa.schedule, `21.Tuesday`)
        assert.equal(next.start, start);
        assert.equal(next.end, end);

        ({ start, end } = lisa.findNextShift({ week, day: "Tuesday" }))
        next = _.get(lisa.schedule, `21.Wednesday`)
        assert.equal(next.start, start);
        assert.equal(next.end, end);

        ({ start, end } = lisa.findNextShift({ week, day: "Wednesday" }))
        next = _.get(lisa.schedule, `21.Thursday`)
        assert.equal(next.start, start);
        assert.equal(next.end, end);

        ({ start, end } = lisa.findNextShift({ week, day: "Thursday" }))
        next = _.get(lisa.schedule, `21.Friday`)
        assert.equal(next.start, start);
        assert.equal(next.end, end);

        ({ start, end } = lisa.findNextShift({ week, day: "Friday" }))
        next = _.get(lisa.schedule, `21.Saturday`)
        assert.equal(next.start, start);
        assert.equal(next.end, end);

        ({ start, end } = lisa.findNextShift({ week, day: "Saturday" }))
        next = _.get(lisa.schedule, `21.Sunday`)
        assert.equal(next.start, start);
        assert.equal(next.end, end);

        ({ start, end } = lisa.findNextShift({ week, day: "Sunday" }))
        assert.equal(undefined, start);
        assert.equal(undefined, end);

    })
})



if (1 == 2) {


    describe('Calcualte insertion time for completion event while accounting fro schedule and task duration', () => {
        lisa.hasSchedule = true
        lisa.schedule = schedule
        lisa.available = true


        it('Add duration directly onto clock', async () => {
            //Monday at 07000
            const clock = 1621832400000 + (hourasseconds * 2)
            const duration = hourasseconds / 2
            const newTime = lisa.addSchedulingTime({ clock, duration })
            assert.equal(newTime, clock + duration);
        })

        it('Add duration and also account for dead-time in schedule', async () => {
            /* should account for the off time between the days */
            /*
    
            8 hours on monday
            all of the dead time between end of monday and start of tuesday
            2 hours of tuesday
    
    
            monday start 1621832400000
            monday end 1621861200000
             = 8 hours = 28800000
    
            duration during night = (tueday start - monday end) = 57600000
    
            tuesday start 1621918800000
             - 3600000
             - 3600000
            tuesday end 1621947600000
            */

            const clock = 1621832400000
            const duration = hourasseconds * 10
            const newTime = lisa.addSchedulingTime({ clock, duration })
            assert.equal(newTime, 1621926000000);
        })

        /* it('Should find nearest available shift', async () => {
            //Monday at 05000
            const clock = 1621832400000-(hourasseconds*2)
            const duration = hourasseconds/2
            const newTime = lisa.addSchedulingTime({clock, duration})
            assert.equal(newTime, 1621832400000 + duration);
        }) */

        /*  
        
          very long durations that span multiple days
    
          duration that exceeds the scheduling
    
          spotty availability
            availble here and there
        
        clock is just before first shift of person
    
        clock is just after shift (during the night)
    
        clock and duration clearly exceed the scheduling for the given day
    
        */

    })
}
