var express = require('express');
var router = express.Router();

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const helper = require("./private");
const appConfigs = require("../../../config");
const { Controller, Executor } = require('../../index');
const { logger } = require('../../helpers/winston');
let processKey = undefined


// TODO: delete any and all configs from camunda
// upload config to camunda
// verify that everything has been uploaded ok
router.post('/config', async function (req, res, next) {
  const dir = `${process.env.PWD}/work`
  try {
    // validate request
    const errorResponse = helper.validateReq({ req, res })
    if (errorResponse) return errorResponse
    // delete any existing configs and store new
    helper.deleteAndStoreConfigs({ dir, req })

    //delete all existing deployments
    await helper.camunda.delete()

    //upload bpmn to camunda
    const { id } = await helper.camunda.upload({ dir })
    processKey = id

    res.status(201).send(`model uploaded: ${id}`)
  } catch (error) {
    logger.log("error", error)
    next(error)
  }
})

router.post('/start', async function (req, res, next) {
  if(!!!processKey) return res.status(400).send("No configs provided. Please upload.")
  // dynamially require input
  const input = require(`${process.env.PWD}/work/payload.json`)

  let startTime = input["start-time"]
  if(!startTime) startTime = new Date()
  const tokens = input.tokens

  const controller = new Controller({ startTime, runIdentifier: uuidv4(), processKey })
  await controller.init({ tokens })
  // return execution log
  const r = await Executor.execute(controller)
  logger.log("info", r)
});
/*  


router.get('/events/:id', async function (req, res, next) {
  //TODO: refactor. should return loca events file instead
  try {
    const events = await mongo.getLogs({ id: req.params.id })
    res.send(events)
  } catch (error) {
    logger.log("error", error)
    next(error)
  }
});

router.get('/process', async function (req, res, next) {
  try {
    var config = {
      method: 'get',
      url: `${appConfigs.controller}/camunda/engine-rest/process-definition`
    };
    const { data } = await axios(config)
    res.send(data)
  } catch (error) {
    logger.log("error", error)
    next(error)
  }
}); */


router.get('/healthz', async function (req, res, next) {

  try {
    await axios({
      url: `${appConfigs.processEngine}`,
      method: 'get',
    });

    res.send(200)
  } catch (error) {
    console.error(error)
    next(error)
  }




})

module.exports = router;