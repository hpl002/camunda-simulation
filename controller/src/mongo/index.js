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
    }, { timestamps: { createdAt: 'created_at' }, })

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
    /* 
    tries to find a preexisting document which is just missing the end date, if so then it adds to this doc. 
    if not exists then add a new one instead
    */


    const { case_id, activity_id, activity_start, activity_end, resource_id } = args
    let filter = { "case_id": case_id, "activity_id": activity_id };
    const Model = mongoose.model(this.collection, this.schema);
    const update = { ...args };

    let foundDocument = await Model.find({
      ...filter,
      'activity_end': {
        '$exists': false
      }
    }).sort({ "created_at": "-1" }).limit(1).lean()

    if (foundDocument.length) {
      foundDocument = foundDocument[0]
      foundDocument.name = 'foo';
      /* update by use of document id */
      const res = await Model.updateOne({
        _id:foundDocument._id
      }, { activity_end })
    }
    else {
      await Model.create(update, function (err, small) {
        if (err) throw err
      });

    }
  }
}







exports.Mongo = Mongo;

