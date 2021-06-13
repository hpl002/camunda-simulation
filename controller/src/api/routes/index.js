var express = require('express');
const axios = require('axios');
var router = express.Router();
const { Controller, Executor } = require('../../index')
const { logger } = require('../../helpers/winston')
const { v4: uuidv4 } = require('uuid');
const { Mongo } = require("../../classes/Mongo") 
var { readFileSync } = require('fs') 

 
/* GET home page. */
router.get('/', function (req, res, nCext) {
  res.render('index', { title: 'Express' });
});
/**
 * @param  {} '/load'
 * @param  {} asyncfunction(req
 * @param  {} res
 * @param  {} next
 * upload files to mongo
 */
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

  router.get('/config/:id', async function (req, res, next) {
    const mongo = new Mongo({ collection: req.params.id, db: "configs" })
      const r = await mongo.getConfig()
      if(r && r.length){ 
        const {camunda, neo4j} = r[0]
        res.send({camunda, neo4j})
      }  
      else{
        res.send(204)
      }
});

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

router.post('/deploy', async function (req, res, next) {
  /*
    TODO: take in all the required parameters and execute
  
  */

  try {

    res.sendStatus(403)
  } catch (error) {
    logger.log("error", error)
    next(error)
  }
});

router.delete('/delete/deployments', async function (req, res, next) {
  try {
    try {
      const { data } = await axios.get(`${process.env.PROCESS_ENGINE}/engine-rest/deployment`)
      const id = []
      data.forEach(d => {
        id.push(d.id)
      });

      while (id.length > 0) {
        const c = id.pop()
        await axios.delete(`${process.env.PROCESS_ENGINE}/engine-rest/deployment/${c}?cascade=true`)
      }

      res.sendStatus(200)
    } catch (error) {
      logger.log("error", error)
      throw error
    }
  } catch (error) {
    logger.log("error", error)
    next(error)
  }
});

router.delete('/delete/process', async function (req, res, next) {
  try {
    try {
      const { data } = await axios.get(`${process.env.PROCESS_ENGINE}/engine-rest/history/process-instance`)
      const id = []
      data.forEach(d => {
        id.push(d.id)
      });

      while (id.length > 0) {
        const c = id.pop()
        await axios.delete(`${process.env.PROCESS_ENGINE}/engine-rest/process-instance/${c}`)
      }

      res.sendStatus(200)
    } catch (error) {
      logger.log("error", error);
      throw error
    }
  } catch (error) {
    logger.log("error", error)
    next(error)
  }
});

module.exports = router;