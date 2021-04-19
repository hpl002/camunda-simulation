var express = require('express');
var router = express.Router();
const { Controller } = require('../../src/index')

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Express' });
});


router.post('/start', async function (req, res, next) {
  const { body } = req
  // initialize new pending events list
  const controller = new Controller({ ...body })
  controller.initPendingEvents({ ...body.input })
  try {
    let r = await controller.execute()
    r = r.map(e=>e.data)
    res.json({ tokens: r})
  } catch (error) {
    console.error(error)
    next(error)
  }
});

module.exports = router;