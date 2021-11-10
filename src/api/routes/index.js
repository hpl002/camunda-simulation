var express = require('express');
var router = express.Router();

const axios = require('axios');
const helper = require("./private");

const appConfigs = require("../../../config");
const { Controller, Executor } = require('../../index');
const { logger } = require('../../helpers/winston'); 


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
    const {id} = await helper.camunda.upload({ dir })

    res.status(201).send(`model uploaded: ${id}`)
  } catch (error) {
    logger.log("error", error)
    next(error)
  }
})
 
/* router.post('/start/:id', async function (req, res, next) {
  const { body, params } = req

  // create schema object
  const schema = Joi.object({
    startTime: Joi.string().required(),
    tokens: Joi.array().items(
      Joi.object({
        distribution: Joi.object({
          type: Joi.string().required(),
          frequency: Joi.any().required(),
          amount: Joi.number().positive().min(1).required(),
        }),
        body: Joi.object().required(),
      })
    )
  })

  // schema options
  const options = {
    abortEarly: true, // include all errors
    allowUnknown: false, // ignore unknown props
    stripUnknown: false // remove unknown props
  };

  try {
    //add schema validation to request
    const { error, value } = schema.validate(req.body, options);
    if (error) {
      throw error
    }
    else {
      req.body = value;
    }

    //load config
    var config = {
      method: 'post',
      url: `${appConfigs.controller}/load/${params.id}`,
    };
    await axios(config)


    //get process key
    var config = {
      method: 'get',
      url: `${appConfigs.controller}/process`,
    };
    const { data } = await axios(config)
    const { key } = data[0]
    console.log(key)


    const runIdentifier = uuidv4()
    const controller = new Controller({ processID: key, startTime: req.body.startTime, runIdentifier })
    await controller.init({ tokens: req.body.tokens })
    const r = await Executor.execute(controller)
    logger.log("info", r)
    res.send(r)
  } catch (error) {
    logger.log("error", error)
    next(error)
  }
});

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
      url: `${appConfigs.mongoHTTP}`,
      method: 'get',
    });

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