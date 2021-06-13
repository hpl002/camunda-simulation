var mongoose = require('mongoose');
const { REPL_MODE_SLOPPY } = require('repl');
var Schema = mongoose.Schema;
var { logger } = require('../helpers/winston');
const sleep = require('util').promisify(setTimeout)



class Mongo {
  constructor({ collection = "events", db="simulation" }) {
    this.collection = collection;
    this.connectionString = `${process.env.MONGO}/${db}` 
    
    this.init()
    var schema = ""
    if(db==="simulation"){
      schema = new Schema({
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
      }, { timestamps: { createdAt: 'created_at' }, })
    }
    else{
      schema = new Schema({                  
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
      }, { timestamps: { createdAt: 'created_at' }, })
    }
    this.schema = schema
  }
  

  init() {
    mongoose.connect(this.connectionString, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 21474899,
    });     
  }
  async getConfig() {          
    logger.log("mongo", `Retrieving configs`)     
    const Model = mongoose.model(this.collection, this.schema);
    const temp = await Model.find()  
    return temp     
  }
  
   async addConfig({id,camunda, neo4j}) {          
    logger.log("mongo", `Uploading configs with id:${id}`)     
    const Model = mongoose.model(this.collection, this.schema);
    await Model.create({ camunda, neo4j}, function (err, small) {
      if (err) throw err
    });
  }

  async startEvent({ case_id, activity_id, activity_start, activity_end, resource_id }) {          
    logger.log("mongo", `Mongo Logging:Starting process case_id:${case_id}`)
    logger.log("mongo", `Mongo Logging:Starting process activity_id:${activity_id}`)
    logger.log("mongo", `Mongo Logging:Starting process activity_start:${activity_start}`)
    logger.log("mongo", `Mongo Logging:Starting process activity_end:${activity_end}`)
    logger.log("mongo", `Mongo Logging:Starting process resource_id:${resource_id}`)     
    const Model = mongoose.model(this.collection, this.schema);
    await Model.create({ case_id, activity_id, activity_start, activity_end, resource_id }, function (err, small) {
      if (err) throw err
    });
  }

  async startTask({ case_id, activity_id, activity_start, resource_id }) {
    logger.log("mongo", `Mongo Logging:Starting task case_id:${case_id}`)
    logger.log("mongo", `Mongo Logging:Starting task activity_id:${activity_id}`)
    logger.log("mongo", `Mongo Logging:Starting task activity_start:${activity_start}`)
    logger.log("mongo", `Mongo Logging:Starting task resource_id:${resource_id}`)     
    if (!(case_id && activity_id &&activity_start && resource_id)) throw new Error("failed while trying to start task due to invalid params")
    const Model = mongoose.model(this.collection, this.schema);
    await Model.create({ case_id, activity_id, activity_start, resource_id }, function (err, small) {
      if (err) throw err
    });
  }

  async completeTask({ case_id, activity_id, activity_end }) {
    logger.log("mongo", `Mongo Logging:Completing task case_id:${case_id}`)
    logger.log("mongo", `Mongo Logging:Completing task activity_id:${activity_id}`)
    logger.log("mongo", `Mongo Logging:Completing task activity_end:${activity_end}`)
    if (!activity_end) throw new Error("cannot complete task with no end time")

    let filter = { "case_id": case_id, "activity_id": activity_id };
    const Model = mongoose.model(this.collection, this.schema);
    let foundDocument = ""
    let counter = 0
    const getDocument = async () => {
      const temp = await Model.find({
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
      const res = await Model.updateOne({
        _id: foundDocument._id
      }, { activity_end })
      if (!!res.n!==true) {
        v = v+1
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







exports.Mongo = Mongo;

