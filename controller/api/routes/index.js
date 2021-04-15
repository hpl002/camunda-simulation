var express = require('express');
var router = express.Router();
const { Controller } = require('../../src/index')

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});


router.post('/start', function(req, res, next) {
const {body} = req
// initialize new pending events list
const controller = new Controller({...body.input})
controller.initPendingEvents({...body.input})
  res.send(controller.getPendingEvents())
});

module.exports = router;

 