const axios = require('axios');
const fs = require('fs');
var FormData = require('form-data');



//ping all services and wipe any state
beforeAll(async () => {
  var { status } = await axios.get(`http://localhost:${process.env.PORT}/healthz`)
  expect(status).toBe(200);

  //delete any existing config
  ({ status } = await axios.delete(`http://localhost:${process.env.PORT}/nuke`))
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
    expect(status).toBe(200);
  })
})
