const { executeQuery } = require('../helpers/neo4j')
const { MathHelper } = require('../helpers/math')

class Activity {
    constructor({ activityId }) {
        this.activityId = activityId
        this.timing = {}
        // all resources which an complete the task
        this.resourceCandidates = []
        this.hasResourceCandidates = false
    }

    async init() {
        //the duration of the task         
        let r  = await this.getTiming({ type: "During" })
        this.timing.duration = await this.generateFunc({...r})
        // the waiting period before a task
        // this waiting period is independent of any resource
        r = await this.getTiming({ type: "Before" })
        this.timing.before = await this.generateFunc({...r})
        this.resourceCandidates = await this.getResources()
        this.hasResourceCandidates = !!this.resourceCandidates.length > 0
    }
    
    async getTiming({ type }) {
        const query = `MATCH (a:Activity)-[]-(t:Timing)-[]-(ty)-[]-(d:Distribution) WHERE a.id="${this.activityId}" and "${type}" in labels(ty) return d`
        let record = await executeQuery({ query })
        record = record.map(e => e.get("d"))
        return record && record[0]
    }
    
    async generateFunc({ properties }) {
        if (!properties || Object.keys(properties).length<=0) {
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
                return MathHelper.normalDistribution({ mean: m, sd })
            }
        }
        else if (type.toUpperCase() === "RANDOM") {
            if (!(min && max)) throw new Error("misconfigured RANDOM")
            return () => {
                return MathHelper.random({ min, max })
            }
        }
        else if (type.toUpperCase() === "POISSON") {
            if (!(value)) throw new Error("misconfigured POISSON")
            return () => {
                return MathHelper.poisson({ value })
            }
        }
        else if (type.toUpperCase() === "BERNOULLI") {
            if (!(value)) throw new Error("misconfigured BERNOULLI")
            return () => {
                return MathHelper.bernoulli({ value })
            }
        }
        else if (type.toUpperCase() === "CONSTANT") {
            if (!(value)) throw new Error("misconfigured CONSTANT")
            return () => {
                return MathHelper.constant({ value })
            }
    
        }
    }
    
    async getResources() {
        const query = `MATCH (a:Activity)-[]-(l:Limitations)-[]-(s:Specialization)-[]-(r:Resource) WHERE a.id="${this.activityId}" return r`
        let record = await executeQuery({ query })
        if (record.length > 0) {
            record = record.map(e => e.get("r"))
            record = record.map(e => e.properties.id)
        }
        return record ? record : []
    }
}

exports.Activity = Activity;