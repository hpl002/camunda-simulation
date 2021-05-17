var express = require('express');
const axios = require('axios');
var router = express.Router();
const { Controller, Executor } = require('../../index')
const { Logger } = require('../../helpers/winston')
/* GET home page. */
router.get('/', function (req, res, nCext) {
  res.render('index', { title: 'Express' });
});


router.post('/start', async function (req, res, next) {
  const { body } = req
  // initialize new pending events list
  const controller = new Controller({ ...body })
  controller.init({ ...body.input })
  try {
    const r = await Executor.execute(controller)
    Logger.log(r)
    res.send(r)
  } catch (error) {
    Logger.log(error)
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
    Logger.log(error)
    next(error)
  }
});

router.delete('/delete/deployments', async function (req, res, next) {
  try {
    try {
      const { data } = await axios.get(`http://localhost:8080/engine-rest/deployment`)
      const id = []
      data.forEach(d => {
        id.push(d.id)
      });

      while (id.length > 0) {
        const c = id.pop()
        await axios.delete(`http://localhost:8080/engine-rest/deployment/${c}?cascade=true`)
      }

      res.sendStatus(200)
    } catch (error) {
      Logger.log(error);
      throw error
    }
  } catch (error) {
    Logger.log(error)
    next(error)
  }
});

router.delete('/delete/process', async function (req, res, next) {
  try {
    try {
      const { data } = await axios.get(`http://localhost:8080/engine-rest/history/process-instance`)
      const id = []
      data.forEach(d => {
        id.push(d.id)
      });

      while (id.length > 0) {
        const c = id.pop()
        await axios.delete(`http://localhost:8080/engine-rest/process-instance/${c}`)
      }

      res.sendStatus(200)
    } catch (error) {
      Logger.log(error);
      throw error
    }
  } catch (error) {
    Logger.log(error)
    next(error)
  }
}); 
module.exports = router;