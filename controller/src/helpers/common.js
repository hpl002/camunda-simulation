var moment = require('moment');
var axios = require("axios").default;

const Common = {
  isoToMilliseconds: (pISO) => {
    try {
      const r = moment.duration(pISO, moment.ISO_8601).asSeconds()
      if (!Number.isInteger(r)) {
        throw new Error(`could not parse time input to seconds. Expected input in the ISO_8601 format. Received ${pISO}`)
      }
      else {
        return r*1000
      }
    } catch (error) {
      console.error(error)
      throw error
    }
  },
  getAttribute: ({ task, attributesMap, key }) => {
    let value = attributesMap[task.activityId] || []
    value = value.filter(e => e.name.toUpperCase() === key)
    return value?.[0]?.value
  },

  refreshRandomVariables: async ({ task }) => {
    try {
      let variables = await axios.get(`http://localhost:8080/engine-rest/variable-instance?processInstanceIdIn=${task.processInstanceId}`)

        variables = variables.data.filter(e => e.name.toUpperCase().includes("RANDOM"))
  
      const obj = {
        "modifications": {
        }
      }

      variables.forEach(element => {
        obj.modifications[element.name] = {
          "value": Math.round(Math.random() * 100),
          "type": "integer"
        }
      });
    
      let response = await axios.post(`http://localhost:8080/engine-rest/process-instance/${task.processInstanceId}/variables`,
        obj)
      if (response.status !== 204) throw new Error("could not update variables on process while starting task")    
    } catch (error) {
      console.error("could not update random variables on process")
      throw error      
    }

  },
}

exports.Common = Common;