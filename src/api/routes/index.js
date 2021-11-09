var express = require('express');
const axios = require('axios');
var router = express.Router();
const { Controller, Executor } = require('../../index')
const { logger } = require('../../helpers/winston')
const { v4: uuidv4 } = require('uuid');
const { mongo } = require("../../classes/Mongo")
var { readFileSync, writeFileSync } = require('fs')
var FormData = require('form-data');
// import os module
const os = require("os");
const fs = require("fs");
const Joi = require("joi");
const tempDir = os.tmpdir()
const appConfigs = require("../../../config");
const { validate } = require("../validator")


//upload config bundle and store locally
router.post('/config', async function (req, res, next) {
  const identifier = uuidv4()

  const validateReq = ({ req, res }) => {
    const schema = require("../schemas/upload-config.json")
    if (!req.body["JSON"]) return res.status(400).send("missing JSON payload")
    //if any newlines in string then remove these 
    let payload = req.body["JSON"].replace(/(\r\n|\n|\r)/gm, "");

    try {
      payload = JSON.parse(payload)
    } catch (error) {
      return res.status(400).send("invlaid payload")
    }
    const validation = validate({ data: payload, schema })
    if (validation.errors && validation.errors.length > 0) return res.status(400).send(validation.errors)

    if (!req?.files?.camunda) {
      return res.status(400).send("Missing camunda bpmn file")
    }
    if (req.files.camunda.name.split(".")[1].toUpperCase() !== "BPMN") {
      return res.status(400).send("camunda: incorrect filetype. Requires .bpmn")
    }
  }

  const writeBPMN = ({ sourceFile, targetDir }) => {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir);
    }

    fs.copyFile(sourceFile, `${targetDir}/${req.files.camunda.name}`, (err) => {
      if (err) throw err;
    });
  }

  const writePayload = async ({ payload, targetDir }) => {
    fs.writeFileSync(`${targetDir}/payload.json`, JSON.stringify(payload, null, 4), (err) => {
      if (err) throw err;
    });
  }

  try {
    const s = validateReq({ req, res })
    if (s) return s

    writeBPMN({ sourceFile: req.files.camunda.tempFilePath, targetDir: `${process.env.PWD}/work` })

    let payload = req.body["JSON"].replace(/(\r\n|\n|\r)/gm, "");
    payload = JSON.parse(payload)
    writePayload({ payload, targetDir: `${process.env.PWD}/work` })

    res.status(201).send(identifier)
  } catch (error) {
    logger.log("error", error)
    next(error)
  }
})
 
//get deployments from camunda
router.get('/deployment', async function (req, res, next) {
  try {
    let { data } = await axios.get(`${appConfigs.processEngine}/camunda/engine-rest/deployment`)
    if (data.length) {
      res.send(data)
    }
    else {
      res.send(204)
    }
  } catch (error) {
    logger.log("error", error)
    next(error)
  }
});

//upload new daployment to camunda
router.post('/deployment', async function (req, res, next) {
  //body to readstream
  var data = new FormData()
  try {
    let value = ""
    const { body } = req
    if (req.headers["content-type"].includes("application/json")) {
      value = body.value
    }
    else {
      value = body
    }
    if (typeof value !== "string") throw new Error("expected bpmn model as string")

    const tempPath = `${tempDir}/temporary.bpmn`
    writeFileSync(tempPath, value);


    data.append('deployment-name', 'aName', { contentType: 'text/plain' });
    data.append('enable-duplicate-filtering', 'true');
    data.append('deployment-source', 'simulation-controller');
    data.append('data', fs.createReadStream(tempPath));

    var config = {
      method: 'post',
      url: `${appConfigs.processEngine}/engine-rest/deployment/create`,
      headers: {
        ...data.getHeaders()
      },
      data: data
    };
  } catch (error) {
    logger.log("error", error)
    next(error)
  }

  axios(config)
    .then(function (response) {
      return res.send("model uploaded");
    })
    .catch(function (error) {
      console.log(error);
      logger.log("error", error)
      next(error)
    });

})

//delete deployments in camunda
router.delete('/deployment', async function (req, res, next) {
  try {
    let { data } = await axios.get(`${appConfigs.controller}/deployment`)
    for (const d of data) {
      await axios.delete(`${appConfigs.controller}/camunda/engine-rest/deployment/${d.id}?cascade=true`)
    }
    res.send(200)
  } catch (error) {
    logger.log("error", error)
    next(error)
  }
});

router.delete('/nuke', async function (req, res, next) {
  try {
    await axios.delete(`${appConfigs.controller}/deployment`)
    res.send(200)
  } catch (error) {
    logger.log("error", error)
    next(error)
  }
});

router.post('/start/:id', async function (req, res, next) {
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
});


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