var express = require('express');
var router = express.Router();
const { controller } = require('../../src/index')

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});


router.post('/start', function(req, res, next) {
const {body} = req

const s =  controller.initPendingEvents({...body.input})
console.log("s", s)

  res.send(200)
});

module.exports = router;

