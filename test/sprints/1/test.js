const axios = require('axios');
const fs = require('fs');
var FormData = require('form-data');
let common = {}
const appConfigs = require("../../../config")


//ping all services
beforeAll(async () => {
  var { status } = await axios.get(`${appConfigs.controller}/healthz`)
  expect(status).toBe(200);

  //delete any existing config
  ({ status } = await axios.delete(`${appConfigs.controller}/nuke`))
  expect(status).toBe(200);


});


describe('Upload only camunda config to mongo', () => {
  let global = {}
  it('Should upload only bpmn mode', async () => {
    var form = new FormData();

    const filepath = require('path').resolve(__dirname, './data/model.bpmn')
    form.append('camunda', fs.createReadStream(filepath));
    global.config = { "bpmn": fs.readFileSync(filepath, "utf8") }




    var config = {
      method: 'post',
      url: 'http://localhost:3000/config',
      headers: {
        ...form.getHeaders()
      },
      data: form
    };

    const response = await axios(config)
    const { status, data } = response
    global.config.id = data
    expect(status).toBe(201);
  })

  it('should get uploaded config with neo4j fallback', async () => {
    var axios = require('axios');

    var config = {
      method: 'get',
      url: `http://localhost:3000/config/${global.config.id}`,
    };

    const response = await axios(config)
    const { status, data } = response
    expect(status).toBe(200);
    expect(Object.keys(data).includes("camunda")).toBe(true);
    expect(Object.keys(data).includes("neo4j")).toBe(true);
    expect(data.neo4j).toBe('CREATE ()');
    expect(data.camunda).toBe(global.config.bpmn);
  })
})

describe('Upload configs to mongo', () => {
  let global = { config: {} }
  it('Should upload both bpmn and neo4j config', async () => {
    var form = new FormData();

    const filepathMongo = require('path').resolve(__dirname, './data/model.bpmn')
    form.append('camunda', fs.createReadStream(filepathMongo));
    global.config.bpmn = fs.readFileSync(filepathMongo, "utf8")

    const filepathNeo = require('path').resolve(__dirname, './data/neo4j.txt')
    form.append('neo4j', fs.createReadStream(filepathNeo));
    global.config.neo4j = fs.readFileSync(filepathNeo, "utf8")


    var config = {
      method: 'post',
      url: 'http://localhost:3000/config',
      headers: {
        ...form.getHeaders()
      },
      data: form
    };

    const response = await axios(config)
    const { status, data } = response
    global.config.id = data
    expect(status).toBe(201);
  })

  it('should get uploaded configs', async () => {
    var axios = require('axios');

    var config = {
      method: 'get',
      url: `http://localhost:3000/config/${global.config.id}`,
    };

    const response = await axios(config)
    const { status, data } = response
    expect(status).toBe(200);
    expect(Object.keys(data).includes("camunda")).toBe(true);
    expect(Object.keys(data).includes("neo4j")).toBe(true);
    expect(data.neo4j).toBe(global.config.neo4j);
    expect(data.camunda).toBe(global.config.bpmn);
  })

  common = global
})

describe('load configs into service ', () => {
  it('should load configs ', async () => {

    var config = {
      method: 'post',
      url: `http://localhost:3000/load/${common.config.id}`,
    };

    const {status} = await axios(config)
    expect(status).toBe(200);
  })

  it('should find deployment in camunda ', async () => {

    var config = {
      method: 'get',
      url: `http://localhost:3000/deployment`,
    };

    const {status, data} = await axios(config)
    expect(status).toBe(200);
    expect(data.length).toBe(1);
  })

  it('should find graph in neo4j ', async () => {

    var config = {
      method: 'get',
      url: `http://localhost:3000/neo4j`,
    };

    const {status, data} = await axios(config)
    expect(status).toBe(200);
    expect(!!(data.length>0)).toBe(true);
  })
})

describe('delete all config ', () => {
  it('should delete all configs', async () => {
    var config = {
      method: 'delete',
      url: `http://localhost:3000/nuke`,
    };

    const {status} = await axios(config)
    expect(status).toBe(200);
  })


  it('should not find deployment in camunda ', async () => {

    var config = {
      method: 'get',
      url: `http://localhost:3000/deployment`,
    };

    const {status, data} = await axios(config)
    expect(status).toBe(204);
    expect(data.length).toBe(0);
  })

  
  it('should not find graph in neo4j ', async () => {

    var config = {
      method: 'get',
      url: `http://localhost:3000/neo4j`,
    };

    const {status, data} = await axios(config)
    expect(status).toBe(204);
    expect(!!(data.length>0)).toBe(false);
  })
})
