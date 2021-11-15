var express = require('express');
var path = require('path');
var fileUpload = require('express-fileupload');
const { createProxyMiddleware } = require('http-proxy-middleware');
const bodyParser = require('body-parser')
const config = require("../../config")

var indexRouter = require('./routes/index');

var app = express(); 

//This is the needed text parser middleware 
//app.use(express.text()); 
app.use(express.text());
app.use(express.json());
 

app.use(fileUpload({
  useTempFiles : true,
  tempFileDir : '/tmp/',
  debug:false
}));

app.use(express.urlencoded({ extended: false }));
app.use('/', indexRouter);
function errorHandler (error, req, res, next) {   
  const {response }= error
  if(response){
    const {status, data} = response
    res.status(status || 500).send(data || "Could not get error")
  }
  else{
    console.error(error)
    res.status(500).send(error.message || "no erorr message available")
  }
   
   
}
app.use(errorHandler)
module.exports = {app};
