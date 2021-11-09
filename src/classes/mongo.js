var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var { logger } = require('../helpers/winston');
const sleep = require('util').promisify(setTimeout)
const config = require("../../config")

class Mongo {
  constructor() {
    this.connectionString = `${config.mongo}/simulation`
    this.init()
    this.model = {
      configs: mongoose.model("configs", new Schema({
        id: {
          type: String,
          required: true,
          immutable: true
        },
        camunda: {
          type: String,
          required: true,
          immutable: true
        },
        neo4j: {
          type: String,
          required: false,
          immutable: true
        },
      }, { timestamps: { createdAt: 'created_at' }, })),

      logs: mongoose.model("logs", new Schema({
        simulation_id: {
          type: String,
          required: true,
          immutable: true
        },
        case_id: {
          type: String,
          required: true,
          immutable: true
        },
        activity_id: {
          type: String,
          required: false,
          immutable: false
        },
        activity_start: {
          type: String,
        },
        activity_end: {
          type: String,
        },
        resource_id: {
          type: String,
        },
        activity_type: {
          type: String,
        },
      }, { timestamps: { createdAt: 'created_at' }, }))
    }
  }

  init() {
    mongoose.connect(this.connectionString, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 21474899,
    });
  }

  async getConfig({ id }) {
    logger.log("mongo", `Retrieving configs`)
    await sleep(500)
    const temp = await this.model.configs.find({ id: id })
    return temp
  }

  async addConfig({ id, camunda, neo4j }) {
    logger.log("mongo", `Uploading configs with id:${id}`)
    await this.model.configs.create({ camunda, neo4j, id }, function (err, small) {
      if (err) throw err
    });
  }

  async getLogs({ id }) {
    logger.log("mongo", `Retrieving logs`)
    await sleep(500)
    const temp = await this.model.logs.find({ simulation_id: id })
    return temp
  }

  async startEvent({id, case_id, activity_id, activity_start, activity_end, resource_id }) {
    logger.log("mongo", `Mongo Logging:Starting process case_id:${case_id}`)
    logger.log("mongo", `Mongo Logging:Starting process activity_id:${activity_id}`)
    logger.log("mongo", `Mongo Logging:Starting process activity_start:${activity_start}`)
    logger.log("mongo", `Mongo Logging:Starting process activity_end:${activity_end}`)
    logger.log("mongo", `Mongo Logging:Starting process resource_id:${resource_id}`)

    await this.model.logs.create({simulation_id:id, case_id, activity_id, activity_start, activity_end, resource_id }, function (err, small) {
      if (err) throw err
    });
  }

  async startTask({id, case_id, activity_id, activity_start, resource_id }) {
    logger.log("mongo", `Mongo Logging:Starting task case_id:${case_id}`)
    logger.log("mongo", `Mongo Logging:Starting task activity_id:${activity_id}`)
    logger.log("mongo", `Mongo Logging:Starting task activity_start:${activity_start}`)
    logger.log("mongo", `Mongo Logging:Starting task resource_id:${resource_id}`)
    if (!(case_id && activity_id && activity_start && resource_id)) throw new Error("failed while trying to start task due to invalid params")
    await this.model.logs.create({simulation_id:id, case_id, activity_id, activity_start, resource_id }, function (err, small) {
      if (err) throw err
    });
  }

  async completeTask({id, case_id, activity_id, activity_end }) {
    logger.log("mongo", `Mongo Logging:Completing task case_id:${case_id}`)
    logger.log("mongo", `Mongo Logging:Completing task activity_id:${activity_id}`)
    logger.log("mongo", `Mongo Logging:Completing task activity_end:${activity_end}`)
    if (!activity_end) throw new Error("cannot complete task with no end time")

    let filter = { "case_id": case_id, "activity_id": activity_id };

    let foundDocument = ""
    let counter = 0
    const getDocument = async () => {
      const temp = await this.model.logs.find({
        ...filter,
        'activity_end': {
          '$exists': false
        }
      }).sort({ "created_at": "-1" }).limit(1).lean()
      counter = counter + 1
      if (temp.length !== 1) {
        await sleep(500)
        await getDocument()
      }
      else {
        counter = 0
        foundDocument = temp[0]
      }
    }
    let v = 0;
    const updateModel = async () => {
      logger.log("mongo", "trying to update document in mongo")
      const res = await this.model.logs.updateOne({
        _id: foundDocument._id
      }, { activity_end })
      if (!!res.n !== true) {
        v = v + 1
        await sleep(500)
        logger.log("mongo", "trying to update document in mongo AGAIN")
        await updateModel()
      }
    }
    if (counter <= 3) {
      await getDocument()
      await updateModel()
    }
    else {
      throw new Error("could not complete document in mongo")
    }
  }
}
 
const mongo = new Mongo() 

exports.mongo = mongo