var express = require('express');
const axios = require('axios');
var router = express.Router();
const { Controller, Executor } = require('../../index')
const { logger } = require('../../helpers/winston')
const { v4: uuidv4 } = require('uuid');
const { Mongo } = require("../../classes/Mongo")
var { readFileSync } = require('fs')
const { executeQuery } = require('../../helpers/neo4j')


//upload config bundle
router.post('/config', async function (req, res, next) {
  const identifier = uuidv4()
  const mongo = new Mongo({ collection: identifier, db: "configs" })

  try {
    if (!req.files.camunda || !req.files.neo4j) {
      throw new Error("could not upload files. Missing either camunda og neo4j")
    }
    else {
      if (req.files.camunda.name.split(".")[1].toUpperCase() !== "BPMN") throw new Error("camunda: incorrect filetype. Requires .bpmn")
      if (req.files.neo4j.name.split(".")[1].toUpperCase() !== "TXT") throw new Error("neo4j: incorrect filetype. Requires .txt")

      let camunda = req.files.camunda.tempFilePath
      let neo4j = req.files.neo4j.tempFilePath


      camunda = readFileSync(camunda).toString()
      neo4j = readFileSync(neo4j).toString()


      mongo.addConfig({ id: identifier, camunda, neo4j })
      res.status(201).send(identifier)
    }
  } catch (error) {
    logger.log("error", error)
    next(error)
  }
})
//get config bundle by id
router.get('/config/:id', async function (req, res, next) {
  const mongo = new Mongo({ collection: req.params.id, db: "configs" })
  const r = await mongo.getConfig()
  if (r && r.length) {
    const { camunda, neo4j } = r[0]
    res.send({ camunda, neo4j })
  }
  else {
    res.send(204)
  }
});


//get deployments from camunda
router.get('/deployment', async function (req, res, next) {
  //TODO: path param for retrieving deployment from neo4j
  try {
    let { data } = await axios.get(`http://localhost:${process.env.PORT}/camunda/engine-rest/deployment`)
    res.send(data)
  } catch (error) {
    res.send(500)
  }
});

//delete deployments in camunda
router.delete('/deployment', async function (req, res, next) {
  try {
    let { data } = await axios.get(`http://localhost:${process.env.PORT}/deployment`)
    for (const d of data) {
      try {
        await axios.delete(`http://localhost:${process.env.PORT}/camunda/engine-rest/deployment/${d.id}?cascade=true`)
      } catch (error) {
        console.log(error);
      }
    }
    res.send(200)
  } catch (error) {
    res.send(500)
  }
});

//delete graph
router.delete('/neo4j', async function (req, res, next) {
  const query = "MATCH (n) DETACH DELETE n"
  try {
    await executeQuery({ query })
    res.send(200)
  } catch (error) {
    res.send(500)
  }
});

//get graph
router.get('/neo4j', async function (req, res, next) {
  const query = "MATCH (n) Return n"
  try {
    let record = await executeQuery({ query })
    if(record.length) res.send(record)
    res.send(204)
  } catch (error) {
    res.send(500)
  }
});

//create greaph. req as plaintext body
router.post('/neo4j', async function (req, res, next) {   
  const { body } = req   
  try {
    await executeQuery({ query:body })
    res.send(200)
  } catch (error) {
    if(error && error.name === "Neo4jError") res.send(error.message)
    res.send(500)
  }
});


//start new simulation run
router.post('/start', async function (req, res, next) {
  const { body } = req
  // initialize new pending events list
  const controller = new Controller({ ...body })
  await controller.init({ ...body.input })
  try {
    const r = await Executor.execute(controller)
    logger.log("info", r)
    res.send(r)
  } catch (error) {
    logger.log("error", error)
    next(error)
  }
});

module.exports = router;