const axios = require('axios');
const fs = require('fs');
var FormData = require('form-data');

const appConfigs = require("../../../config")

//ping all services and wipe any state
beforeAll(async () => {
  var { status } = await axios.get(`${appConfigs.controller}/healthz`)
  expect(status).toBe(200);

  //delete any existing config
  ({ status } = await axios.delete(`${appConfigs.controller}/nuke`))
  expect(status).toBe(200);


});

describe('simple simulation run', () => {
  let global = { config: {} }
  it('Should upload both bpmn and neo4j config', async () => {
    var form = new FormData();

    const filepathMongo = require('path').resolve(__dirname, './data/simple/model.bpmn')
    form.append('camunda', fs.createReadStream(filepathMongo));
    global.config.bpmn = fs.readFileSync(filepathMongo, "utf8")

    const filepathNeo = require('path').resolve(__dirname, './data/simple/neo4j.txt')
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

  it('Should start a simulation run using the uploaded config', async () => {
    //this is a run where the simulation config is empty(has no nodes)
    var config = {
      method: 'post',
      url: `http://localhost:3000/start/${global.config.id}`,
      data: JSON.stringify({
        "startTime": "2021-04-14T19:15:30+0000",
        "tokens": [
          {
            "distribution": {
              "type": "constant",
              "frequency": "PT0M",
              "amount": 1
            },
            "body": {
              "name": "troy",
              "animal": "dog",
              "age": 14
            }
          }
        ]
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const response = await axios(config)
    const { status, data } = response
    global.config.startTime = "2021-04-14T19:15:30+0000"
    global.config.log = {id:data.collection_identifier}

    expect(!!data.collection_identifier).toBe(true);
    expect(status).toBe(200);
  })

  it('Should retrieve event log', async () => {
    //this is a run where the simulation config is empty(has no nodes)
    var config = {
      method: 'get',
      url: `http://localhost:3000/events/${global.config.log.id}`,       
    };

    const response = await axios(config)
    const { status, data } = response
     global.config.log.data =  data
     
    expect(status).toBe(200);
    expect(data.length).toBe(2); 
    data.forEach(element => {
      expect(element["simulation_id"]).toBe(global.config.log.id);       
    });

expect(data.length).toBe(2);      
  })

  it('should not have any added durations to any tasks', async () => {
    //this is a run where the simulation config is empty(has no nodes)     
     //get time at which simulation was started, all subsequent events should be the same
     const startAsEpoch = Date.parse(global.config.startTime)
    global.config.log.data.forEach(element => {
      const start = Date.parse(element["activity_start"])
      const end = Date.parse(element["activity_end"])
       
      expect(start).toBe(startAsEpoch);
      expect(end).toBe(startAsEpoch);
    });


  })

})
