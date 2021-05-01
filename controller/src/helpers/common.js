var moment = require('moment');

const Common = {
    isoToSeconds: (pISO) => {
      try {
        const r = moment.duration(pISO, moment.ISO_8601).asSeconds()
        if (!Number.isInteger(r)) {
          throw new Error(`could not parse time input to seconds. Expected input in the ISO_8601 format. Received ${pISO}`)
        }
        else {
          return r
        }
      } catch (error) {
        console.error(error)
        throw error
      }
    }
  }

  exports.Common = Common;