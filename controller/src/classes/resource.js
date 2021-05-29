var moment = require('moment');
var _ = require('lodash');
const { executeQuery } = require('../helpers/neo4j')
const { Common } = require('../helpers/common')


class Resource {
  constructor({ available = true, lockedUntil = "", task = "", id, hasSchedule = false }) {
    this.id = id,
      this.available = available
    this.lockedUntil = lockedUntil
    this.task = task
    this.schedule = {}
  }

  async hasSchedule() {
    const queryForHasSchedule = `MATCH (r:Resource)-[]-(sc:Schedule)  Where r.id="${this.id}" return sc`
    let hasSchedule = await executeQuery({ query: queryForHasSchedule })
    this.hasSchedule = !!hasSchedule.length > 0
  }

  asEpoch({ time, day, week, year }) {
    const hour = parseInt(time.split(":")[0])
    const minutes = parseInt(time.split(":")[1])
    const t = moment().year(year).isoWeek(week).isoWeekday(day).hour(hour).minute(minutes).second(0).millisecond(0).toDate().valueOf()
    const b = Common.convertToReadableTime(t)
    return t


  }

  // basically create an entire calendar for the given resource. Starting from the current week and day     
  async buildSchedule() {
    const year = 2021
    let weeks = await Helper.getWeeks({ id: this.id })
    for (const week of weeks) {
      let days = await Helper.getDays({ week, id: this.id })
      for (const day of days) {
        const start = await Helper.getTiming({ week, id: this.id, day, type: "Start" })
        const end = await Helper.getTiming({ week, id: this.id, day, type: "End" })
        if (start && end) {
          _.set(this.schedule, `${week}.${day}`, {
            start:
              { readable: start, epoch: this.asEpoch({ time: start, day, week, year }), full: Common.convertToReadableTime(this.asEpoch({ time: start, day, week, year })) },
            end: { readable: end, epoch: this.asEpoch({ time: end, day, week, year }), full: Common.convertToReadableTime(this.asEpoch({ time: end, day, week, year })) }
          })
          console.log("asd")
        }
        else {
          const message = `could not build schedule for day:${day} in week ${week} for resource ${this.id} due to missing start or end time`
          logger.log("error", message)
          throw new Error(message)
        }
      }
    }
  }

  /**
   *  TODO: if soonest available is today then it should return this
   * TODO: throw error if nothing is found
   */
  soonestAvailability({ time }) {
    const { week, day, full, hour } = Common.convertToReadableTime(time)
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    let result = undefined
    let weeks = Object.keys(this.schedule)
    weeks = weeks.map(e => parseInt(e))
    weeks = weeks.filter(e => e >= week)
    weeks.sort(function (a, b) {
      return a - b;
    });
    let numInWeek = days.findIndex(e => e === day)
    const { start, end } = _.get(this.schedule, `${week}.${day}`)
    if (time >= start.epoch && time <= end.epoch) {
      result = time
      return result
    }
    else {
      weeks.forEach(week => {
        for (let index = numInWeek; index <= days.length; index++) {
          const { start, end } = _.get(this.schedule, `${week}.${days[index]}`)
          if (time >= start.epoch && time <= end.epoch) {
            result = start
            return result
          }
        }
        numInWeek = 0
      });
    }
    return result
  }

  remainingTimeOfShift({ week, day, clock }) {
    const { start, end } = _.get(this.schedule, `${week}.${day}`)
    const remainingTime = end.epoch - clock
    return remainingTime
  }

  findNextShift({ week, day }) {
    // find next shift     
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    let result = {}

    let weeks = Object.keys(this.schedule)
    weeks = weeks.map(e => parseInt(e))
    weeks = weeks.filter(e => e >= week)
    weeks.sort(function (a, b) {
      return a - b;
    });
    let dayAsNumber = days.findIndex(e => e === day) + 1

    for (const week of weeks) {
      for (let index = dayAsNumber; index <= days.length; index++) {
        const v = _.get(this.schedule, `${week}.${days?.[index]}`)
        if (v?.start && v?.end) {
          result = v
          break
        }
      }
      dayAsNumber = 0
      if (Object.keys(result).length>0) {
        break
      }
    }

    return result
  }

  timeFromEndOfCurrentToStartOfNext({ week, day }) {
    const current = _.get(this.schedule, `${week}.${day}`)
    const next = this.findNextShift({ week, day })
    return next.start.epoch - current.end.epoch
  }

  /**
   * @param  {} {clock
   * @param  {} duration}    
   */
  addSchedulingTime({ clock, duration }) {
    let result = undefined
    let { week, day, full, hour } = Common.convertToReadableTime(clock)
    let tally = 0

    if (!!this.schedule?.[week]?.[day]) {
      //has scedule for today
      const remainingTimeShift = this.remainingTimeOfShift({ clock, week, day })
      if (remainingTimeShift >= duration) {
        return clock + duration
      }
    }

    while(duration>0){
      const { start, end } = this.findNextShift({week, day})
      // there are no future shifts
      if(!start && !end) return undefined

      const shiftDuration = end.epoch-start.epoch
      if(shiftDuration>duration){
        return soonestShift.start.epoc + duration
      }
      else{
        duration = duration - shiftDuration
        tally = tally+shiftDuration
        tally = tally+timeFromEndOfCurrentToStartOfNext({week, day})
      }
      ({ start, end } = findNextShift({ week, day: "Sunday" }))
    }
   

    //if no time left today
    // loop
    // getSoonestAvailableShift() -> if today then return today
    // how much time is left of shift getRemainingTimeInShift() -> if today then return remaining time of today
    // if duration is less than remaining time then add duration to current clock and terminate
    // else add remaining time of shift to tally 
    // subtract remaining time from duration
    // get time from current shift to next shift and add this to tally
    //--iterate



    if (!!this.schedule?.[week]?.[day]) {
      const remainingTimeShift = this.remainingTimeOfShift({ clock, week, day })
      //if remaining time in shift is less than the total duration of task then it can be completed before next shift
      if (remainingTimeShift >= duration) {
        result = clock + duration
      }
      else {
        let remainingDuration = duration - remainingTimeShift
        let accumulatedTime = remainingTimeShift
        while (remainingDuration > 0) {
          //get time from end of current shift to start of next

        }


      }
    }

    return result
  }

  async init() {
    await this.hasSchedule()
    if (this.hasSchedule) {
      await this.buildSchedule()
    }
  }
}

const Helper = {
  getWeeks: async ({ id }) => {
    const queryForWeeks = `MATCH (r:Resource)-[]-(sc:Schedule)-[]-(w:Week)  Where r.id="${id}" return w`
    let weeks = await executeQuery({ query: queryForWeeks })
    weeks = weeks.map(e => e.get("w"))
    weeks = weeks.map(w => w.properties.Number)
    return weeks
  },
  getDays: async ({ week, id }) => {
    const queryForDaysInWeek = `MATCH (r:Resource)-[]-(s:Schedule)-[]-(w:Week)-[]-()-[]-(t:Time)-[]-(d) WHERE r.id="${id}" AND w.Number=${week} return d`
    let days = await executeQuery({ query: queryForDaysInWeek })
    days = days.map(e => e.get("d"))
    days = days.map(e => e.labels)
    days = [].concat(...days)
    days = [...new Set(days)]
    return days
  },
  getTiming: async ({ week, id, day, type }) => {
    const queryForTime = `MATCH (r:Resource)-[]-(s:Schedule)-[]-(w:Week)-[]-(type)-[]-(t:Time)-[]-(d) WHERE r.id="${id}" AND w.Number=${week} and "${day}" IN labels(d) AND "${type}" IN labels(type) return t`
    let t = await executeQuery({ query: queryForTime })
    t = t.map(e => e.get("t"))
    t = t.map(t => t?.properties?.Value)
    t = t.length > 0 ? t[0] : undefined
    return t
  }
}


exports.Resource = Resource;

