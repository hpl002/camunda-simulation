var axios = require("axios").default;
var xml2js = require('xml2js');
var _ = require('lodash');
var parser = new xml2js.Parser();
var moment = require('moment');
var _ = require('lodash');
const { executeQuery } = require('../helpers/neo4j')


class Resource {
  constructor({ available = true, lockedUntil = "", task = "", id, hasSchedule = false }) {
    this.id = id,
      this.available = available
    this.lockedUntil = lockedUntil
    this.task = task
    this.schedule = {}
    this.hasSchedule = false
  }

  async hasSchedule() {
    const queryForHasSchedule = `MATCH (r:Resource)-[]-(sc:Schedule)  Where r.id="${this.id}" return sc`
    let hasSchedule = await executeQuery({ query: queryForHasSchedule })
    this.hasSchedule = !!hasSchedule.length > 0
  }

  // basically create an entire calendar for the given resource. Starting from the current week and day     
  async buildSchedule() {
    let weeks = await Helper.getWeeks({ id: this.id })
    for (const week of weeks) {
      let days = await Helper.getDays({ week, id: this.id })
      for (const day of days) {
        const start = await Helper.getTiming({ week, id: this.id, day, type: "Start" })
        const end = await Helper.getTiming({ week, id: this.id, day, type: "End" })
        if (start && end) {
          _.set(this.schedule, `${week}.${day}`, { start: start, end: end })
        }
        else {
          const message = `could not build schedule for day:${day} in week ${week} for resource ${this.id} due to missing start or end time`
          logger.log("error", message)
          throw new Error(message)
        }
      }
    }
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

