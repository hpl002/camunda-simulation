var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var { logger } = require('../helpers/winston');
const sleep = require('util').promisify(setTimeout)
const config = require("../../config")

module.exports = {
    Mongo: class {
        constructor() {
            this.connectionString = `${config.mongo}/simulation`
            this.model = {
                /* configs: mongoose.model("configs", new Schema({
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
                }, { timestamps: { createdAt: 'created_at' }, })), */

                logs: mongoose.model("logs", new Schema({
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
                    token_id: {
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
            this.connection = mongoose.connect(this.connectionString, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                serverSelectionTimeoutMS: 21474899,
            });
        }

        /* async getConfig({ id }) {
            logger.log("mongo", `Retrieving configs`)
            await sleep(500)
            const temp = await this.model.configs.find({ id: id })
            return temp
        } */

        /* async addConfig({ id, camunda, neo4j }) {
            logger.log("mongo", `Uploading configs with id:${id}`)
            await this.model.configs.create({ camunda, neo4j, id }, function (err, small) {
                if (err) throw err
            });
        } */

        async getLogs() {
            // get all records
            console.log("retrieving all data from mongo")
            const data = await this.model.logs.find({ "case_id": { $regex: /./, $options: 'i' } })
            let res = data.map(e => e._doc)
            res.forEach(element => {
                //del unwanted data
                delete element._id
                delete element.__v
                delete element.created_at
                delete element.updatedAt
            });


            return res

        }

        async writeToLog({ string, case_id, activity_id, activity_start = undefined, activity_end = undefined, resource_id, token_id }) {
            if (!!(case_id && activity_id && (activity_start || activity_end)) === false) throw new Error("tried to write to log wihout prividing values for all requiredparams")
            logger.log("mongo", `Mongo Logging:${string} case_id:${case_id}`)
            logger.log("mongo", `Mongo Logging:${string} activity_id:${activity_id}`)
            logger.log("mongo", `Mongo Logging:${string} activity_start:${activity_start}`)
            logger.log("mongo", `Mongo Logging:${string} activity_end:${activity_end}`)
            logger.log("mongo", `Mongo Logging:${string} resource_id:${resource_id}`)
            await this.model.logs.create({ case_id, activity_id, activity_start, activity_end, resource_id, token_id }, function (err, small) {
                if (err) throw err
            });
        }

        async startEvent({ token_id, case_id, activity_id, activity_start, resource_id = undefined }) {
            await this.writeToLog({ string: "Start Process", case_id, activity_id, activity_start, resource_id, token_id })
        }

        async endEvent({ token_id, case_id, activity_id, activity_start, resource_id = undefined }) {
            await this.writeToLog({ string: "Start Process", case_id, activity_id, activity_start, resource_id, token_id })
        }

        async startTask({ token_id, case_id, activity_id, activity_start, resource_id = undefined }) {
            await this.writeToLog({ string: "Start Task", case_id, activity_id, activity_start, resource_id, token_id })
        }

        async completeTask({token_id, case_id, activity_id, activity_end, resource_id = undefined }) {
            logger.log("mongo", `Mongo Logging:Completing task case_id:${case_id}`)
            logger.log("mongo", `Mongo Logging:Completing task activity_id:${activity_id}`)
            logger.log("mongo", `Mongo Logging:Completing task activity_end:${activity_end}`)
            logger.log("mongo", `Mongo Logging:Starting task resource_id:${resource_id}`)
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

        async wipe() {

            const { deletedCount } = await this.model.logs.deleteMany({ "case_id": { $regex: /./, $options: 'i' } }, function (err) {
                if (err) throw err
                // deleted at most one tank document
            });
            console.log("number of records deleted from mongo", deletedCount)
        }
    }
}




