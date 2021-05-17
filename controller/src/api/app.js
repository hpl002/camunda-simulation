var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
const { createProxyMiddleware } = require('http-proxy-middleware');

var indexRouter = require('./routes/index');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
//app.use(cookieParser());
//app.use(express.static(path.join(__dirname, 'public')));
app.use('/', indexRouter);
app.use('/camunda', createProxyMiddleware({ target: process.env.PROCESS_ENGINE, changeOrigin: true, pathRewrite: {'^/camunda' : ''} }));
function errorHandler (error, req, res, next) {   
  const {response }= error
  if(response){
    const {status, data} = response
    res.status(status).send(data)
  }
  res.status(500).send(error.message || "no erorr message available")
   
   
}
app.use(errorHandler)
module.exports = app;
