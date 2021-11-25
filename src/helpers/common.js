var moment = require('moment');
var axios = require("axios").default;
const { logger } = require('./winston')
const config = require("../../config")



const Common = {
  isoToMilliseconds: (pISO) => {
    try {
      const r = moment.duration(pISO, moment.ISO_8601).asSeconds()
      if (!Number.isInteger(r)) {
        throw new Error(`could not parse time input to seconds. Expected input in the ISO_8601 format. Received ${pISO}`)
      }
      else {
        return r * 1000
      }
    } catch (error) {
      logger.log("error", error)
      throw error
    }
  },
  getAttribute: ({ task, attributesMap, key }) => {
    let value = attributesMap[task.activityId] || []
    value = value.filter(e => e.name.toUpperCase() === key)
    value = value?.[0]?.value
    return value
  },
  /**
   * @param  {} {processInstanceId
   * @param  {} variables}
   * https://docs.camunda.org/manual/7.5/reference/rest/process-instance/variables/post-variables/
   * must be packaged in modification obj
   */
  refreshRandomVariables: async ({ processInstanceId, variables }) => {
    const obj = {
      "modifications": {
        ...variables
      }
    }
    try {
      let response = await axios.post(`${config.processEngine}/engine-rest/process-instance/${processInstanceId}/variables`,
      obj)
      if (response.status !== 204) throw new Error("could not update variables on process while starting task")
    } catch (error) {
      logger.log("error", "could not update random variables on process")
      throw error
    }

  },
  formatClock: (time) => {
    return moment(parseInt(time)).format("YYYY-MM-DD HH:mm:ss")
  },
  formatWeek: (time) => {
    return moment(parseInt(time)).format("W")
  },
  formatDay: (time) => {
    return  moment(parseInt(time)).format('dddd');     
  },
  formatHour: (time) => {
    return  moment(parseInt(time)).format('HH:mm');     
  },
  convertToReadableTime(pTime) {
    const temp = {}
    temp.full = Common.formatClock(pTime)
    temp.week = parseInt(Common.formatWeek(pTime))
    temp.day = Common.formatDay(pTime)
    temp.hour = Common.formatHour(pTime)
    return temp
  }
}

exports.Common = Common;