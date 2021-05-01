var axios = require("axios").default;
var xml2js = require('xml2js');
var _ = require('lodash');
var parser = new xml2js.Parser();
var moment = require('moment');

 

class Resource {
  constructor({ available = true, lockedUntil = "", task = "", id }) {
    this.id = id,
      this.available = available
    this.lockedUntil = lockedUntil
    this.task = task
  }
}
 
exports.Resource = Resource;

