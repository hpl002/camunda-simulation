var express = require('express');
var router = express.Router();

const axios = require('axios');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { parse } = require('json2csv');
const _get = require('lodash.get');

const helper = require("./private");
const appConfigs = require("../../../config");
const { Executor } = require('../../index');
const { Controller } = require('../../helpers/controller');
const { Mongo } = require('../../classes/mongo');
const neo4j = require("../../../controller/src/helpers/neo4j")
const mongo = new Mongo()
mongo.init()

const { logger } = require('../../helpers/winston');
let processKey = undefined


// TODO: delete any and all configs from camunda
// upload config to camunda
// verify that everything has been uploaded ok
router.post('/config', async function (req, res, next) {
  const dir = `${process.env.PWD}/work`
  try {
    // validate request
    const schema = require("../schemas/upload-config.json")
    const errorResponse = helper.validateReq({ req, res, schema })
    if (errorResponse) return errorResponse
    // delete any existing configs and store new
    helper.deleteAndStoreConfigs({ dir, req })
    // delete all data in neo4j
    const driver = neo4j.init()
    await neo4j.executeQuery({ query: "MATCH (n) DETACH DELETE n", driver })

    //parse and update configs
    // translate all regular tasks to serivce tasks
    // create array of all service task ids
    const { serviceTaskIds } = await helper.parseAndUpdateConfig({ dir, req })
    // ensure that all references tasks exist
    let input = fs.readFileSync(`${process.env.PWD}/work/payload.json`, "utf-8")
    input = JSON.parse(input)

    //initialize new resoruce graph in neo4j 
    if (input.initialize_resources) {
      await neo4j.executeQuery({ query: input.initialize_resources, driver })
      // check to see that records were indeed inserted
      const result = await neo4j.executeQuery({ query: "MATCH (n) RETURN n LIMIT 25", driver })
      if (result.length < 1) throw new Error("Cypher create query produced zero nodes")
      let ids = []
      result.records.forEach(record => {
        const c = _get(record, "_fields[0].properties.id", false)
        if (!c) throw new Error("could not find id on node")        
        ids.push(c)
      });

      function hasDuplicates(array) {
        return (new Set(array)).size !== array.length;
    }
    if(hasDuplicates(ids)) throw new Error("Found multiple nodes with the same id. All nodes most have a unique id")        
      if(input.tasks){
        for (const task of input.tasks) {
          if (task["resource-query"]) {
            const result = await neo4j.executeQuery({ query: task["resource-query"], driver })
            if (result.records.length < 1) throw new Error("Could not find any hits for resource query", task["resource-query"])
            if ( task["resources-required"] && result.records.length < task["resources-required"]) throw new Error("Task has a resource requirement that is greater than the number of hits on query. Requirement can never be met", task["resource-query"])
          }
        }
      }
    }


    if (input.tasks) {
      input.tasks.forEach(task => {
        if (!serviceTaskIds.find(e => e === task.id)) throw new Error(`could not find a matching task in .bpmn model for task in payload: ${task.id}`)
      });
    }

    //delete all existing deployments
    await helper.camunda.delete()

    //upload bpmn to camunda
    const { id } = await helper.camunda.upload({ dir })
    processKey = id
    neo4j.close({ driver })
    res.status(201).send(`model uploaded: ${id}`)
  } catch (error) {
    logger.log("error", error)
    next(error)
  }
})

router.post('/start', async function (req, res, next) {
  if (!req.body["response"]) return res.status(400).send("missing response on req body")
  const schema = require("../schemas/start.json")
  const errorResponse = helper.validateReqAgainstSchema({ data: req.body, res, schema })
  if (errorResponse.length > 0) return res.status(400).send(errorResponse)
  if (!!!processKey) return res.status(400).send("No configs provided. Please upload.")

  await mongo.wipe()

  // dynamially require input
  //const input = require(`${process.env.PWD}/work/payload.json`)
  let input = fs.readFileSync(`${process.env.PWD}/work/payload.json`, "utf-8")
  input = JSON.parse(input)
  let startTime = input["start-time"]
  if (!startTime) startTime = new Date()
  let { tokens, variables } = input
  const controller = new Controller({ startTime, runIdentifier: uuidv4(), processKey })
  await controller.init({ tokens, variables, shuffle:input["shuffle-tokens"] })
  controller.input = input

  try {
    await Executor.execute({ controller, mongo })
    // get all data from mongo
    let log = await mongo.getLogs()
    if (req.body.response === "json") {
      res.type('application/json')
      // get all case_ids
      let caseids = log.map(e => e.case_id)
      caseids = new Set(caseids)
      caseids = Array.from(caseids)

      const final = {}
      caseids.forEach(id => {
        final[id] = log.filter(e => e.case_id === id)
      });
      log = final

    }
    else if (req.body.response === "csv") {
      // convert to vsc
      try {
        res.type('text/csv')
        const csv = parse(log, { fields: ['case_id', 'activity_id', 'activity_start', "resource_id", "activity_end"] });
        log = csv
        console.log(csv);
      } catch (err) {
        console.error(err);
      }

    }

    res.send(log)
  } catch (error) {
    next(error)
  }

});


router.get('/healthz', async function (req, res, next) {

  try {
    await axios({
      url: `${appConfigs.processEngine}`,
      method: 'get',
    });

    await axios({
      url: `${appConfigs.mongoPing}`,
      method: 'get',
    });

    res.send(200)
  } catch (error) {
    console.error(error)
    next(error)
  }




})

module.exports = router;