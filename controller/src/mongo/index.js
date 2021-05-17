var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var { logger } = require('../helpers/winston');



class Mongo {
  constructor({ collection = "events" }) {
    this.collection = collection;
    this.connectionString = process.env.MONGO

    var EventLogSchema = new Schema({
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
    })

    this.schema = EventLogSchema
    this.init()
  }


  init() {
    mongoose.connect(process.env.MONGO, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 21474899,
    });
    //Get the default connection
    var db = mongoose.connection;
    //Bind connection to error event (to get notification of connection errors)
  }
  /**
   * @param  {} {case_id
   * @param  {} activity_id=""
   * @param  {} activity_start=""
   * @param  {} activity_end=""
   * @param  {} resource_id=""}
   */
  async add(args) {
    const { case_id, activity_id, activity_start, activity_end, resource_id } = args
    const Model = mongoose.model(this.collection, this.schema);
    const filter = { "case_id": case_id, "activity_id": activity_id };
    const update = { ...args };
    const options = {
      // Return the document after updates are applied
      new: true,
      // Create a document if one isn't found. Required
      // for `setDefaultsOnInsert`
      upsert: true,
      setDefaultsOnInsert: true,

      // had to set this due to deprecation warning
      useFindAndModify: false
    };
    logger.log("info", update)
    const res = await Model.findOneAndUpdate(filter, update, options)
    logger.log("info", res)
  }
}


/* (async () => {

  const t = new Mongo({ collection: this.collection })
  await t.add({ case_id: "test4", activity_id:"6552121212118" })
})()
 */




exports.Mongo = Mongo;

