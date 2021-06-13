const { Resource } = require('../../src/classes/resource')
var _ = require('lodash');
var chai = require('chai');
var assert = chai.assert;
const hourasseconds = 3600000
const { Common } = require('../../src/helpers/common')




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
        setDefault({ type: "schedule" })
        const week = 21
        const day = "Monday"
        const currentEnd = 1621861200000
        const next = _.get(lisa.schedule, `21.Tuesday`)
        const nextStart = 1621918800000
        const time = lisa.timeFromEndOfCurrentToStartOfNext({ week, day })
        assert.equal(time, nextStart - currentEnd);
    })

    it('Should find the duration from end of current shift to start of next shift the following week', async () => {
        setDefault({ type: "schedule-gaps" })
        const week = 21
        const day = "Saturday"
        const currentEnd = lisa.schedule["21"]["Saturday"].end.epoch
        const nextStart = lisa.schedule["22"]["Thursday"].start.epoch
        const time = lisa.timeFromEndOfCurrentToStartOfNext({ week, day })
        assert.equal(time, nextStart - currentEnd);
    })
})

describe('Check to see if suggested time is within the scope of resource schedule', () => {

    it('Should return false because resource does not have schedule for week 22', async () => {
        setDefault({ type: "schedule" })
        const time = lisa.schedule["21"]["Sunday"].start.epoch + (hourasseconds * 48)
        const canComplete = lisa.permittedCompletionTime({ time })
        assert.equal(canComplete, false);
    })

    it('Should return true because resource does not have a schedule that permits this', async () => {
        setDefault({ type: "schedule" })
        const time = lisa.schedule["21"]["Monday"].start.epoch + (hourasseconds*2)
        const canComplete = lisa.permittedCompletionTime({ time })
        assert.equal(canComplete, false);
    })
})



describe('Find next scheduled shift', () => {
    it('Should find the scheduled shift, the following day', async () => {
        setDefault({ type: "schedule" })
        const week = 21
        const day = "Monday"
        const next = _.get(lisa.schedule, `21.Tuesday`)
        const { start, end } = lisa.findNextShift({ week, day })
        assert.equal(next.start, start);
        assert.equal(next.end, end);
    })

    it('Should find the scheduled shift but using a different starting point, the following day', async () => {
        setDefault({ type: "schedule" })
        const week = 21
        const day = "Thursday"
        const next = _.get(lisa.schedule, `21.Friday`)
        const { start, end } = lisa.findNextShift({ week, day })
        assert.equal(next.start, start);
        assert.equal(next.end, end);
    })

    it('Should find the scheduled shift but now uses a schedule with gaps', async () => {
        setDefault({ type: "schedule-gaps" })
        const week = 21
        const day = "Tuesday"
        const next = _.get(lisa.schedule, `21.Friday`)
        const { start, end } = lisa.findNextShift({ week, day })
        assert.equal(next.start, start);
        assert.equal(next.end, end);
    })

    it('Should find the scheduled shift but now uses a schedule with gaps and multiple weeks', async () => {
        setDefault({ type: "schedule-gaps" })
        const week = 21
        const day = "Saturday"
        const next = _.get(lisa.schedule, `22.Thursday`)
        const { start, end } = lisa.findNextShift({ week, day })
        assert.equal(next.start, start);
        assert.equal(next.end, end);
    })

    it('Should return the following shift by specifying todays shift', async () => {
        setDefault({ type: "schedule" })
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





describe('Calcualte insertion time for completion event while accounting fro schedule and task duration', () => {
    it('Short duration, to be executed same day', async () => {
        setDefault({ type: "schedule" })
        //Monday at 07000
        const clock = 1621832400000
        const duration = hourasseconds / 2 //30 min
        const newTime = lisa.addSchedulingTime({ clock, duration })
        assert.equal(newTime, clock + duration);
    })


    it('Little longer duration, to be executed same day', async () => {
        setDefault({ type: "schedule" })
        //Monday at 07000
        const clock = 1621832400000
        const duration = hourasseconds * 6 //6 hours
        const newTime = lisa.addSchedulingTime({ clock, duration })
        assert.equal(newTime, clock + duration);
    })

    it('Longer duration, to be executed next day', async () => {
        setDefault({ type: "schedule" })
        //Monday at 07000
        const clock = 1621832400000

        const deadTime = lisa.timeFromEndOfCurrentToStartOfNext({ week: 21, day: "Monday" })

        const duration = hourasseconds * 10 //6 hours
        const newTime = lisa.addSchedulingTime({ clock, duration })
        assert.equal(newTime, clock + duration + deadTime);
    })

    it('Very long duration, to be executed 3 days later', async () => {
        setDefault({ type: "schedule" })
        // 30 hours and 8 hours a day = 3.75 days
        // All of monday 30-8 = 22
        // All of tuesday 22-8 = 14
        // All of wednesday 14-8 = 6
        // 6 hours of thursday
        // finish towards end of thursday

        //Monday at 07000
        const clock = 1621832400000
        /*get deadtime from  Monday to Tuesday*/
        const deadTime = lisa.timeFromEndOfCurrentToStartOfNext({ week: 21, day: "Monday" })
        /*get deadtime from  Tuesday to Wednesday*/
        const deadTime1 = lisa.timeFromEndOfCurrentToStartOfNext({ week: 21, day: "Tuesday" })
        /*get deadtime from  Wednesday to Thursday*/
        const deadTime2 = lisa.timeFromEndOfCurrentToStartOfNext({ week: 21, day: "Wednesday" })
        const duration = hourasseconds * 30 //30 hours

        const sum = clock + duration + deadTime + deadTime1 + deadTime2

        const newTime = lisa.addSchedulingTime({ clock, duration })
        /* console.log("sum as calculated", Common.convertToReadableTime(sum))
        console.log("newTime as calculated", Common.convertToReadableTime(newTime)) */

        assert.equal(newTime, sum);
    })

    it('Long duration but spotty schedule, to be executed following week', async () => {
        setDefault({ type: "schedule-gaps" })
        // 20 hours and 8 hours a day = 2.5 days
        // All of saturday 20-8 = 12
        // All of thursday 12-8 = 4
        // 4 hours of of sunday 


        //Saturday at 07000 Week 21
        const clock = 1622264400000
        /*get deadtime from  Saturday(21) to Thursday(22)*/
        const deadTime = lisa.timeFromEndOfCurrentToStartOfNext({ week: 21, day: "Saturday" })
        /*get deadtime from  Thursday(22) to sunday(22)*/
        const deadTime1 = lisa.timeFromEndOfCurrentToStartOfNext({ week: 22, day: "Thursday" })

        const duration = hourasseconds * 20 //30 hours
        const sum = clock + duration + deadTime + deadTime1
        const newTime = lisa.addSchedulingTime({ clock, duration })
        /* console.log("sum as calculated", Common.convertToReadableTime(sum))
        console.log("newTime as calculated", Common.convertToReadableTime(newTime)) */

        assert.equal(newTime, sum);
    })



    it('Semi-long duration, attempt to start schedule during night', async () => {
        setDefault({ type: "schedule" })
        // 10 hours 
        // All of saturday 10-8 = 2
        // 2 hours of Thursday 



        //Tuesday at 0700 Week 21
        let clock = 1621918800000

        //Turn back time two hours (0500)


        const duration = hourasseconds * 10 //10 hours

        const sum = clock + duration
        const newTime = lisa.addSchedulingTime({ clock: clock - (2 * hourasseconds), duration })
        /* console.log("sum as calculated", Common.convertToReadableTime(sum))
        console.log("newTime as calculated", Common.convertToReadableTime(newTime)) */

        assert.equal(newTime, sum);
    })

    it('Short duration, attempt to start on non-existing day', async () => {
        setDefault({ type: "schedule-gaps" })
        //Should jump up to Thursday         
        // 2 hours of Thursday 

        //Monday at 0700 Week 22 --> does not exist in schedule
        let Monday = 1622437200000
        const Thursday = 1622696400000



        const duration = hourasseconds * 2 //2 hours

        const sum = Thursday + duration
        const newTime = lisa.addSchedulingTime({ clock: Thursday, duration })
        /* console.log("sum as calculated", Common.convertToReadableTime(sum))
        console.log("newTime as calculated", Common.convertToReadableTime(newTime)) */

        assert.equal(newTime, sum);
    })


    it('Too long duration, attempt to start task that exceeds availale schedule', async () => {
        setDefault({ type: "schedule" })
        //Try to start a task on Saturday that would end in next week, but there exists no next week         
        // 20 hours

        //Saturday at 0700 Week 21 
        let Saturday = 1622264400000

        //If schedule for week 22 existed then it should have ended in the midlde of monday

        const duration = hourasseconds * 20 //2 hours

        const newTime = lisa.addSchedulingTime({ clock: Saturday, duration })

        assert.equal(newTime, undefined);
    })

    describe('Account for resource efficiency by adding additional timing to task duration', () => {
        it('add a constant 20 percent', async () => {
            setDefault({ type: "schedule" })

            const properties =
            {
                identity: 31,
                labels: [
                    "Distribution",
                ],
                properties: {
                    type: "CONSTANT",
                    value: 0.8,
                },
            }

            const week = 21
            const day = "Monday"
            const currentEnd = 1621861200000
            const nextStart = 1621918800000
            let time = lisa.timeFromEndOfCurrentToStartOfNext({ week, day })
            lisa.efficiencyDistribution = properties
            time = await lisa.efficiency({ time, options: { iso: false } })
            let res = nextStart - currentEnd
            res = res + res * 0.2
            assert.equal(time, res);
        })

        it('add a constant 40 percent', async () => {
            setDefault({ type: "schedule" })

            const properties =
            {
                identity: 31,
                labels: [
                    "Distribution",
                ],
                properties: {
                    type: "CONSTANT",
                    value: 0.6,
                },
            }

            const week = 21
            const day = "Monday"
            const currentEnd = 1621861200000
            const nextStart = 1621918800000
            let time = lisa.timeFromEndOfCurrentToStartOfNext({ week, day })
            lisa.efficiencyDistribution = properties
            time = await lisa.efficiency({ time, options: { iso: false } })
            let res = nextStart - currentEnd
            res = res + res * 0.4
            assert.equal(time, res);
        })
    })


})

