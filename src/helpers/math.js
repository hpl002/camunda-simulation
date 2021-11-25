const { Common } = require('./common');
const random = require('random');

const MathHelper = {
    normalDistribution({ mean, sd, iso=true }) {
        if(iso){
            if (typeof mean !== "string" || typeof sd !== "string") throw new Error("input has to be formatted as iso8601 duration")
            mean = Common.isoToMilliseconds(mean)
            sd = Common.isoToMilliseconds(sd)
        }

        if (sd > mean) {
            throw new Error("standard deviation cannot be greater than the mean")
        }

        const s = random.normal((mu = mean), (sigma = sd))
        //TODO: awaiting fix -> https://github.com/transitive-bullshit/random/issues/30
        let res = Math.round(s())
        if(res<0) return 0
        return res
    },

/*     bernoulli({ value, iso=true }) {
        if(iso){
            if (typeof value !== "string") throw new Error("input has to be formatted as iso8601 duration")
            value = Common.isoToMilliseconds(value)
        }

        const s = random.bernoulli((p = value))
        let res = Math.round(s())
        while (res < 0) {
            res = Math.round(s())
        }

        return res
    }, */

   /*  poisson({ value, iso=true }) {
        if(iso){
            if (typeof value !== "string") throw new Error("input has to be formatted as iso8601 duration")
            value = Common.isoToMilliseconds(value)
        }

        const s = random.poisson((lambda = value))
        let res = Math.round(s())
        while (res < 0) {
            res = Math.round(s())
        }

        return res
    },
      */
    random({ min, max, iso=true }) {
        if(iso){
            min = Common.isoToMilliseconds(min)
            max = Common.isoToMilliseconds(max)
        }
        return random.int(min, max)
    },
    
    constant({ value, iso=true }) {
        if(iso){
            return Common.isoToMilliseconds(value)
        }
        return value
    },
}

exports.MathHelper = MathHelper;