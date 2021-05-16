var axios = require("axios").default;
var xml2js = require('xml2js');
var _ = require('lodash');
var parser = new xml2js.Parser();
var moment = require('moment');

class ModelReader {
  constructor({ key }) {
    this.xml = {};
    this.js = {};
    this.attributes = {};
    this.key = key;
  }

  async getModel() {
    try {
      const response = await axios.get(`http://localhost:8080/engine-rest/process-definition/key/${this.key}/xml`)
      const { data, status } = response
      const { bpmn20Xml } = data
      if (status === 200) {
        this.xml = bpmn20Xml
      }
      else {
        throw new Error("could not get xml model from process engine")
      }
    } catch (error) {
      console.error(error)
      throw error
    }
  }


  async parseModel() {
    return parser.parseStringPromise(this.xml).then(function (result) {
      return result;
    }).catch((e) => {
      console.error(e)
      throw new Error("Failed while parsing xml string to js")
    })
  }


  generateAttributesMap() {
    const attributesMap = {}
    try {
      let activities = this.js["bpmn:definitions"]["bpmn:process"][0]
      Object.keys(activities).forEach(element => {
        if (!element.includes("bpmn")) delete activities[element]
      });

      const serviceTasks = activities["bpmn:serviceTask"]

      serviceTasks.forEach(element => {
        const bpmnObj = _.find(element, function (o) { return o.name !== undefined; });
        attributesMap[bpmnObj.id] = []

        attributesMap[bpmnObj.id] = [{
          "name": 'DESCRIPTION',
          "value": bpmnObj.name
        }]

        let properties = _.get(element, 'bpmn:extensionElements[0].camunda:properties[0].camunda:property');
        if (Array.isArray(properties)) {
          properties.forEach(p => {
            const obj = _.find(p, function (o) { return o.name !== undefined; });
            Object.keys(obj).forEach(key => {
              if (typeof obj[key] === 'string' || obj[key] instanceof String) {
                obj[key] = obj[key].trim()
              }
            });
            attributesMap[bpmnObj.id].push(obj)
          });
        }
      });
      return attributesMap
    } catch (error) {
      console.error(error)
      throw error
    }
  }


  async init() {
    await this.getModel()
    this.js = await this.parseModel()
    // reads the xml model
    // parses out all activities in map 
  }
}

exports.ModelReader = ModelReader;