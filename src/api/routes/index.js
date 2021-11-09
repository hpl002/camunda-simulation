var express = require('express');
const axios = require('axios');
var router = express.Router();
const { Controller, Executor } = require('../../index')
const { logger } = require('../../helpers/winston')
const { v4: uuidv4 } = require('uuid');
const { mongo } = require("../../classes/Mongo")
var { readFileSync, writeFileSync } = require('fs')
const { executeQuery } = require('../../helpers/neo4j')
var FormData = require('form-data');
// import os module
const os = require("os");
const fs = require("fs");
const Joi = require("joi");
const tempDir = os.tmpdir()
const appConfigs = require("../../../config");

//upload config bundle
router.post('/config', async function (req, res, next) {
  const identifier = uuidv4()

  try {
    if (!req.files.camunda) {
      throw new Error("could not upload files. Missing camunda")
    }
    else {
      let neo4j = ""
      if (req.files.camunda.name.split(".")[1].toUpperCase() !== "BPMN") throw new Error("camunda: incorrect filetype. Requires .bpmn")
      let camunda = req.files.camunda.tempFilePath
      camunda = readFileSync(camunda).toString()
      if (req.files.neo4j) {
        if (req.files.neo4j.name.split(".")[1].toUpperCase() !== "TXT") throw new Error("neo4j: incorrect filetype. Requires .txt")
        neo4j = req.files.neo4j.tempFilePath
        neo4j = readFileSync(neo4j).toString()
      }
      else {
        neo4j = "CREATE ()"
      }

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

  const r = await mongo.getConfig({ id: req.params.id })
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
  //TODO:  request targets itself, which im sure is a bad pattern..
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
    await axios.delete(`${appConfigs.controller}/neo4j`)
    res.send(200)
  } catch (error) {
    logger.log("error", error)
    next(error)
  }
});

//delete graph
router.delete('/neo4j', async function (req, res, next) {
  const query = "MATCH (n) DETACH DELETE n"
  try {
    await executeQuery({ query })
    res.send(200)
  } catch (error) {
    logger.log("error", error)
    next(error)
  }
});

//get graph
router.get('/neo4j', async function (req, res, next) {
  const query = "MATCH (n) Return n"
  try {
    let record = await executeQuery({ query })
    if (record.length) {
      res.send(record)
    }
    else {
      res.send(204)
    }
  } catch (error) {
    logger.log("error", error)
    next(error)
  }
});

//create greaph. req as plaintext body
router.post('/neo4j', async function (req, res, next) {
  const { body } = req


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
    await executeQuery({ query: value })
    res.send(200)
  } catch (error) {
    if (error && error.name === "Neo4jError") res.send(error.message)
    logger.log("error", error)
    next(error)
  }
});

router.post('/load/:id', async function (req, res, next) {
  try {
    const { body, params } = req
    //get configs
    let { data, status } = await axios.get(`${appConfigs.controller}/config/${params.id}`)
    if (status !== 200) throw new Error("could not find any configs for the provided id")
    const { camunda, neo4j } = data

    //delete and upload new camunda config
    await axios.delete(`${appConfigs.controller}/deployment`)

    await axios({
      url: `${appConfigs.controller}/deployment`,
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      data: { value: camunda }
    });

    //delete and upload new neo4j config
    await axios.delete(`${appConfigs.controller}/neo4j`)
    await axios({
      url: `${appConfigs.controller}/neo4j`,
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      data: { value: neo4j }
    });

    res.send(200)
  } catch (error) {
    logger.log("error", error)
    next(error)
  }

})

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
  try {     
    const events = await mongo.getLogs({ id:  req.params.id })
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
      url: `${appConfigs.mongo}`,
      method: 'get',
    });

    await axios({
      url: `${appConfigs.processEngine}`,
      method: 'get',
    });


    try {
      await axios({
        url: `${appConfigs.neo4j}`,
        method: 'get',
      });
    } catch (error) {
      const { status } = error.response
      if (!(status === 200 || status === 400)) throw new Error("could not connect to Neo4j")
    }


    res.send(200)
  } catch (error) {
    console.error(error)
    next(error)
  }




})

module.exports = router;