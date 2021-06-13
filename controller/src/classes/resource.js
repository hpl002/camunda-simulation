var moment = require('moment');
var _ = require('lodash');
const { executeQuery } = require('../helpers/neo4j')
const { Common } = require('../helpers/common')
const { MathHelper } = require('../helpers/math');
const { logger } = require('../helpers/winston');


class Resource {
  constructor({ available = true, lockedUntil = "", task = "", id, hasSchedule = false }) {
    this.id = id,
      this.available = available
    this.lockedUntil = lockedUntil
    this.task = task
    this.schedule = {}
    this.duration = 0
    this.efficiencyDistribution = {}
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

  async getSpecializations() {
    const query = `MATCH (r:Resource)-[]-(s:Specialization) WHERE r.id="${this.id}" return s.id`
    let s = await executeQuery({ query })
    s = s.map(e => e.get("s.id"))
    this.specialization = s
  }

  soonestAvailability({ time }) {
    const { week, day, full, hour } = Common.convertToReadableTime(time)
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    let result = undefined
    let weeks = Object.keys(this.schedule)
    weeks = weeks.map(e => parseInt(e))
    weeks = weeks.filter(e => e >= week)
    weeks.sort((a, b) => a > b)     
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
      if (Object.keys(result).length > 0) {
        break
      }
    }

    return result
  }

  timeFromEndOfCurrentToStartOfNext({ week, day }) {
    const current = _.get(this.schedule, `${week}.${day}`)
    const next = this.findNextShift({ week, day })
    const res = next?.start?.epoch - current?.end?.epoch
    return Number.isInteger(res) ? res : undefined
  }

  /**
   * @param  {} {clock
   * @param  {} duration}    
   */
  addSchedulingTime({ clock, duration }) {
    let { week, day, full, hour } = Common.convertToReadableTime(clock)
    let tally = 0

    if (!!this.schedule?.[week]?.[day]) {
      let start = this.schedule?.[week]?.[day].start.epoch
      if (start > clock) {
        //duration from clock to start time
        return (start - clock) + clock + duration
      }
      else {
        const remainingTimeShift = this.remainingTimeOfShift({ clock, week, day })
        if (remainingTimeShift >= duration) {
          return clock + duration
        }
      }
    }

    let { start, end } = this.findNextShift({ week, day })
    let next = {}
    while (duration > 0) {
      // there are no future shifts
      if (!start && !end) return undefined

      const shiftDuration = end.epoch - start.epoch
      if (shiftDuration > duration) {
        return start.epoch + duration
      }
      else {
        duration = duration - shiftDuration
        tally = tally + shiftDuration
        if (!this.timeFromEndOfCurrentToStartOfNext({ week, day })) return undefined
        tally = tally + this.timeFromEndOfCurrentToStartOfNext({ week, day })
      }

      ({ start, end } = this.findNextShift({ week, day }))
      if (start && end) {
        ({ week, day } = Common.convertToReadableTime(start.epoch))
      }
    }



  }

  /**
   * @param  {} {time
   * @param  {} options}
   * add additional time to clock to account for a reduced efficiency
   */
  async efficiency({ time, options }) {
    if (this.efficiencyDistribution === false || Object.keys(this.efficiencyDistribution).length == 0) {
      // query neo4j to get distribution connected to efficiency
      const query = `MATCH (r:Resource)-[]-(e:Efficiency)-[]-(d:Distribution) WHERE r.id="${this.id}" return d`
      let distribution = await executeQuery({ query })
      distribution = distribution.map(e => e.get("d"))
      this.efficiencyDistribution = distribution.length > 0 ? { ...distribution[0] } : false
    }
    let dragPercentage = 0 //no lag
    if (this.efficiencyDistribution) {
      const r = this.generateFunc({ ...this.efficiencyDistribution, options })
      const v = r()
      dragPercentage = Math.round((1 - v + Number.EPSILON) * 100) / 100
      if (dragPercentage >= 1) throw new Error(`resource efficiency cannot be reduced beyond 100 percent. Attempted to declare that resource was working at ${v} efficiency`)
      console.log("asd");
    }
    logger.log("process", "adding additional time to task duration to account for a reduced efficiency")
    return time + (time * dragPercentage)
  }
  /**
   * @param  {} {time}
   * check if the input time is within the permitted schedule
   * if the input time is outside the resource schedule then the schedule cannot complete it
   */
  permittedCompletionTime({ time }) {
    if (!this.hasSchedule) return true
    const { day, week, full, } = Common.convertToReadableTime(time)
    const v = _.get(this.schedule, `${week}.${day}`)
    if (v?.start && v?.end) {
      //check if time falls within the given range        
      return (v.start <= time && v.end >= time)
    }
    else {
      return false
    }
  }


  generateFunc({ properties, options }) {

    if (!properties || Object.keys(properties).length <= 0) {
      return () => {
        return 0
      }
    }
    const { type, value, m, sd, min, max } = properties
    if (!type) {
      logger.log("error", "distribution is configured incorrectly. Could not find type")
      throw new Error("distribution is configured incorrectly. Could not find type")
    }
    if (type.toUpperCase() === "NORMALDISTRIBUTION") {
      if (!(m && sd)) throw new Error("misconfigured NORMALDISTRIBUTION")
      return () => {
        return MathHelper.normalDistribution({ mean: m, sd, ...options })
      }
    }
    else if (type.toUpperCase() === "RANDOM") {
      if (!(min && max)) throw new Error("misconfigured RANDOM")
      return () => {
        return MathHelper.random({ min, max, ...options })
      }
    }
    else if (type.toUpperCase() === "POISSON") {
      if (!(value)) throw new Error("misconfigured POISSON")
      return () => {
        return MathHelper.poisson({ value, ...options })
      }
    }
    else if (type.toUpperCase() === "BERNOULLI") {
      if (!(value)) throw new Error("misconfigured BERNOULLI")
      return () => {
        return MathHelper.bernoulli({ value, ...options })
      }
    }
    else if (type.toUpperCase() === "CONSTANT") {
      if (!(value)) throw new Error("misconfigured CONSTANT")
      return () => {
        return MathHelper.constant({ value, ...options })
      }

    }
  }

  async init() {
    await this.getSpecializations()
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

