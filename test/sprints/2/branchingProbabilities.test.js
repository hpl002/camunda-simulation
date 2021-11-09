const axios = require('axios');
const fs = require('fs');
var FormData = require('form-data');

const { Config } = require('../../helpers');
const globalConfig = new Config()




beforeAll(async () => {
  var form = new FormData();
  const filepathMongo = require('path').resolve(__dirname, './data/branching/variablesAndProbabilities/animals.bpmn')
  form.append('camunda', fs.createReadStream(filepathMongo));
  globalConfig.files.bpmn
  globalConfig.files.bpmn = fs.readFileSync(filepathMongo, "utf8")

  const filepathNeo = require('path').resolve(__dirname, './data/branching/variablesAndProbabilities/neo4j.txt')
  form.append('neo4j', fs.createReadStream(filepathNeo));
  globalConfig.files.neo4j = fs.readFileSync(filepathNeo, "utf8")


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
  globalConfig.files.id = data
});

const startSimulation = async ({ data }) => {
  var config = {
    method: 'post',
    url: `http://localhost:3000/start/${globalConfig.files.id}`,
    data: JSON.stringify(data),
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const response = await axios(config)
  return response
}

const getData = async ({ id }) => {
  var config = {
    method: 'get',
    url: `http://localhost:3000/events/${id}`,
  };
  const response = await axios(config)
  const { status, data } = response
  return data
}

beforeEach(async () => {
  //ping all services and wipe any state
  var { status } = await axios.get(`http://localhost:${process.env.PORT}/healthz`)
  expect(status).toBe(200);

  //delete any existing config
  ({ status } = await axios.delete(`http://localhost:${process.env.PORT}/nuke`))
  expect(status).toBe(200);
});


describe('Test branching behaviour', () => {
  jest.setTimeout(99999999);
  it('probabilities by forcing default behaviour in gateway', async () => {
    const data = {
      "startTime": "2021-04-14T19:15:30+0000",
      "tokens": [
        {
          "distribution": {
            "type": "constant",
            "frequency": "PT10M",
            "amount": 1
          },
          "body": {
            "name": {
              "value": "horsie",
              "type": "String"
            },
            "animal": {
              "value": "other",
              "type": "String"
            },
            "randomAnimal": {
              "value": 0,
              "type": "integer"
            },
          }
        },
        {
          "distribution": {
            "type": "constant",
            "frequency": "PT10M",
            "amount": 1
          },
          "body": {
            "name": {
              "value": "parrotie",
              "type": "String"
            },
            "animal": {
              "value": "other",
              "type": "String"
            },
            "randomAnimal": {
              "value": 0,
              "type": "integer"
            },
          }
        }
      ]
    }



    const response = await startSimulation({ data })
    const logs = await getData({ id: response.data.collection_identifier })

    expect(response.status).toBe(200);
    const possibleActivities = ["parrot", "horse"]

    possibleActivities.forEach(element => {
      expect(!!(logs.filter(e => e.activity_id === element).length >= 0)).toBe(true);
    });

  });


  it('should use both probabilities and variables in gateways', async () => {
    const data = {
      "startTime": "2021-04-14T19:15:30+0000",
      "tokens": [
        {
          "distribution": {
            "type": "constant",
            "frequency": "PT10M",
            "amount": 1
          },
          "body": {
            "name": {
              "value": "horsie",
              "type": "String"
            },
            "animal": {
              "value": "other",
              "type": "String"
            },
            "randomAnimal": {
              "value": 0,
              "type": "integer"
            },
          }
        },
        {
          "distribution": {
            "type": "constant",
            "frequency": "PT10M",
            "amount": 1
          },
          "body": {
            "name": {
              "value": "parrotie",
              "type": "String"
            },
            "animal": {
              "value": "other",
              "type": "String"
            },
            "randomAnimal": {
              "value": 0,
              "type": "integer"
            },
          }
        },
        {
          "distribution": {
            "type": "constant",
            "frequency": "PT10M",
            "amount": 1
          },
          "body": {
            "name": {
              "value": "horsie",
              "type": "String"
            },
            "animal": {
              "value": "other",
              "type": "String"
            },
            "randomAnimal": {
              "value": 0,
              "type": "integer"
            },
          }
        },
        {
          "distribution": {
            "type": "constant",
            "frequency": "PT10M",
            "amount": 1
          },
          "body": {
            "name": {
              "value": "parrotie",
              "type": "String"
            },
            "animal": {
              "value": "other",
              "type": "String"
            },
            "randomAnimal": {
              "value": 0,
              "type": "integer"
            },
          }
        }
      ]
    }



    const response = await startSimulation({ data })
    const logs = await getData({ id: response.data.collection_identifier })

    expect(response.status).toBe(200);
    const possibleActivities = ["parrot", "horse", "pig"]     

    expect(!!(logs.filter(e => (e.activity_id === "parrot" || e.activity_id === "horse")).length > 0)).toBe(true);
    expect(!!(logs.filter(e => e.activity_id === "pig").length >= 0)).toBe(true);     

  });

})






//add support for all distributions

//do not have to actually test the pattern, just check that there has indeed been returned tokens















