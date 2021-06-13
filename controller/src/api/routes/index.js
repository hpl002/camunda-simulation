var express = require('express');
const axios = require('axios');
var router = express.Router();
const { Controller, Executor } = require('../../index')
const { logger } = require('../../helpers/winston')
const { v4: uuidv4 } = require('uuid');
const { Mongo } = require("../../classes/Mongo")
var { readFileSync, writeFileSync } = require('fs')
const { executeQuery } = require('../../helpers/neo4j')
var FormData = require('form-data');
// import os module
const os = require("os");
const fs = require("fs");
const tempDir = os.tmpdir()
const mongoConfigs = new Mongo({ collection: "configs"})

//upload config bundle
router.post('/config', async function (req, res, next) {
  const identifier = uuidv4()
   

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


      mongoConfigs.addConfig({ id: identifier, camunda, neo4j })
      res.status(201).send(identifier)
    }
  } catch (error) {
    logger.log("error", error)
    next(error)
  }
})
//get config bundle by id
router.get('/config/:id', async function (req, res, next) {
   
  const r = await mongoConfigs.getConfig({id:req.params.id})
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

//upload new daployment to camunda
router.post('/deployment', async function (req, res, next) {
  //body to readstream
  var data = new FormData()
  try {
    const { body } = req
    if (typeof body !== "string") throw new Error("expected bpmn model as string")       
            
    const tempPath = `${tempDir}/temporary.bpmn`      
    writeFileSync(tempPath, body);


    data.append('deployment-name', 'aName', { contentType: 'text/plain' });
    data.append('enable-duplicate-filtering', 'true');
    data.append('deployment-source', 'simulation-controller');
    data.append('data', fs.createReadStream(tempPath));

    var config = {
      method: 'post',
      url: `${process.env.PROCESS_ENGINE}/engine-rest/deployment/create`,
      headers: {
        ...data.getHeaders()
      },
      data: data
    };
  } catch (error) {
    next(error)
  }

  axios(config)
    .then(function (response) {
      return res.send("model uploaded");
    })
    .catch(function (error) {
      console.log(error);
      next(error)
    });

})


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
    if (record.length) res.send(record)
    res.send(204)
  } catch (error) {
    res.send(500)
  }
});

//create greaph. req as plaintext body
router.post('/neo4j', async function (req, res, next) {
  const { body } = req
  try {
    await executeQuery({ query: body })
    res.send(200)
  } catch (error) {
    if (error && error.name === "Neo4jError") res.send(error.message)
    res.send(500)
  }
});

 
/*
 
load deployment
load graph

start simulation

return results

validate req body against schema
*/


router.post('/start', async function (req, res, next) {
  try {
  const { body, params } = req
  //get configs
  const {camunda, neo4j} = axios.get(`http://localhost:${process.env.PORT}//config/${params.id}`)
  
  
  //delete and upload new camunda config
  await axios.delete(`http://localhost:${process.env.PORT}/deployment`)
  await axios.post(`http://localhost:${process.env.PORT}/deployment`, {
    camunda
  })
  
  //delete and upload new neo4j config
  await axios.delete(`http://localhost:${process.env.PORT}/neo4j`)
  await axios.post(`http://localhost:${process.env.PORT}/neo4j`, {
    neo4j
  })



    /* // initialize new pending events list
    const controller = new Controller({ ...body })
    await controller.init({ ...body.input })
    const r = await Executor.execute(controller)
    logger.log("info", r)
    res.send(r) */
    res.send(200)
  } catch (error) {
    logger.log("error", error)
    next(error)
  }
});

module.exports = router;