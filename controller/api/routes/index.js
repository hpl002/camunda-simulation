var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});


router.post('/start', function(req, res, next) {
  console.log("asd")

  

  res.send(200)
});

module.exports = router;
