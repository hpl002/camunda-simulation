const { Common } = require('./common');
const random = require('random');

const MathHelper = {
    normalDistribution({ mean, sd }) {
        if (typeof mean !== "string" || typeof sd !== "string") throw new Error("input has to be formatted as iso8601 duration")
        mean = Common.isoToMilliseconds(mean)
        sd = Common.isoToMilliseconds(sd)
        if (sd > mean) {
            throw new Error("standard deviation cannot be greater than the mean. Check model", task)
        }

        const s = random.normal((mu = mean), (sigma = sd))
        //TODO: awaiting fix -> https://github.com/transitive-bullshit/random/issues/30
        let res = Math.round(s())
        while (res < 0) {
            res = Math.round(s())
        }

        return res
    },

    bernoulli({ value }) {
        if (typeof mean !== "value") throw new Error("input has to be formatted as iso8601 duration")
        value = Common.isoToMilliseconds(value)

        const s = random.bernoulli((p = value))
        let res = Math.round(s())
        while (res < 0) {
            res = Math.round(s())
        }

        return res
    },

    poisson({ value }) {
        if (typeof mean !== "value") throw new Error("input has to be formatted as iso8601 duration")
        value = Common.isoToMilliseconds(value)

        const s = random.poisson((lambda = value))
        let res = Math.round(s())
        while (res < 0) {
            res = Math.round(s())
        }

        return res
    },

    random({ min, max }) {
        min = Common.isoToMilliseconds(min)
        max = Common.isoToMilliseconds(max)
        return random.int(min, max)
    },

    constant({ value }) {
        return Common.isoToMilliseconds(value)
    },
}

exports.MathHelper = MathHelper;