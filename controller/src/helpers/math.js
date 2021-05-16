const { Common } = require('./common');
const { Worker } = require('./worker');
const random = require('random');

const MathHelper = {
    normalDistribution({ task, attributesMap, type }) {
        type = type.toUpperCase()
        let mean = Common.getAttribute({ task, attributesMap, key: `${type}_MEAN` })
        let sd = Common.getAttribute({ task, attributesMap, key: `${type}_STANDARDDEVIATION` })

        mean = Common.isoToSeconds(mean)
        sd = Common.isoToSeconds(sd)

        const s = random.normal((mu = mean), (sigma = sd))
        return Math.round(s())
    },

    random({ task, attributesMap, type }) {
        type = type.toUpperCase()

        let minDuration = Common.getAttribute({ task, attributesMap, key: `${type}_MINDURATION` })
        let maxDuration = Common.getAttribute({ task, attributesMap, key: `${type}_MAXDURATION` })

        minDuration = Common.isoToSeconds(minDuration)
        maxDuration = Common.isoToSeconds(maxDuration)

        return random.int(minDuration, maxDuration)
    },


    constant({ task, attributesMap, type }) {
        type = type.toUpperCase()
        let duration = Common.getAttribute({ task, attributesMap, key: `${type}` })
        return Common.isoToSeconds(duration)
    },
}

exports.MathHelper = MathHelper;