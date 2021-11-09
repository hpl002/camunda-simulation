const axios = require('axios');
const fs = require('fs');
var FormData = require('form-data');

const { Config } = require('../../helpers');
const globalConfig = new Config()
globalConfig.files.before = {}
globalConfig.files.during = {}
globalConfig.files.beforeDuring = {}

const appConfigs = require("../../../config")


const initConfig = async ({ type, when = "during" }) => {
  var form = new FormData();
  const filepathMongo = require('path').resolve(__dirname, './data/timing/model.bpmn')
  form.append('camunda', fs.createReadStream(filepathMongo));
  globalConfig.files.bpmn
  globalConfig.files.bpmn = fs.readFileSync(filepathMongo, "utf8")

  const filepathNeo = require('path').resolve(__dirname, `./data/timing/${when}/${type}.txt`)
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
  globalConfig.files[when][type] = data
}

beforeAll(async () => {
  await initConfig({ type: "constant" })
  await initConfig({ type: "normal" })
  await initConfig({ type: "poisson" })
  await initConfig({ type: "random" })


  await initConfig({ type: "constant", when: "before" })
  await initConfig({ type: "normal", when: "before" })
  await initConfig({ type: "poisson", when: "before" })
  await initConfig({ type: "random", when: "before" })

  await initConfig({ type: "constant", when: "beforeDuring" })
});

beforeEach(async () => {
  //ping all services and wipe any state
  var { status } = await axios.get(`${appConfigs.controller}/healthz`)
  expect(status).toBe(200);

  //delete any existing config
  ({ status } = await axios.delete(`${appConfigs.controller}/nuke`))
  expect(status).toBe(200);
});

const startSimulation = async ({ data, type, when = "during" }) => {
  var config = {
    method: 'post',
    url: `http://localhost:3000/start/${globalConfig.files[when][type]}`,
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


describe('Test task timing: activity duration', () => {
  jest.setTimeout(99999999);
  it('should add a constant time to each event', async () => {
    const data = {
      "startTime": "2021-04-14T19:15:30+0000",
      "tokens": [
        {
          "distribution": {
            "type": "constant",
            "frequency": "PT10M",
            "amount": 1
          },
          "body": {}
        },
      ]
    }
    const response = await startSimulation({ data, type: "constant" })
    const logs = await getData({ id: response.data.collection_identifier })

    const definitions = {
      "isThirsty": {
        "activity_end": '2021-04-14 21:18:30',
        "activity_start": '2021-04-14 21:15:30'
      },

      "drinkWater": {
        "activity_end": '2021-04-14 21:21:30',
        "activity_start": '2021-04-14 21:18:30'
      }
    }

    expect(response.status).toBe(200);
    logs.forEach(element => {
      expect(definitions[element.activity_id].activity_start).toBe(element.activity_start);
      expect(definitions[element.activity_id].activity_end).toBe(element.activity_end);
    });
  });

  it('should add a normal distribution time to each event', async () => {
    const data = {
      "startTime": "2021-04-14T19:15:30+0000",
      "tokens": [
        {
          "distribution": {
            "type": "constant",
            "frequency": "PT10M",
            "amount": 1
          },
          "body": {}
        },
      ]
    }
    const response = await startSimulation({ data, type: "normal" })
    const logs = await getData({ id: response.data.collection_identifier })


    expect(response.status).toBe(200);
    //check that they are all increaseing in duration 
    const startTime = Date.parse("2021-04-14T19:15:30+0000")
    logs.forEach(element => {
      expect(Date.parse(element.activity_end) > startTime).toBe(true);
    });
  });

  it('should add a poisson distribution time to each event', async () => {
    const data = {
      "startTime": "2021-04-14T19:15:30+0000",
      "tokens": [
        {
          "distribution": {
            "type": "constant",
            "frequency": "PT10M",
            "amount": 1
          },
          "body": {}
        },
      ]
    }
    const response = await startSimulation({ data, type: "poisson" })
    const logs = await getData({ id: response.data.collection_identifier })


    expect(response.status).toBe(200);
    //check that they are all increaseing in duration 
    const startTime = Date.parse("2021-04-14T19:15:30+0000")
    logs.forEach(element => {
      expect(Date.parse(element.activity_end) > startTime).toBe(true);
    });
  });

  it('should add a random  time to each event', async () => {
    const data = {
      "startTime": "2021-04-14T19:15:30+0000",
      "tokens": [
        {
          "distribution": {
            "type": "constant",
            "frequency": "PT10M",
            "amount": 1
          },
          "body": {}
        },
      ]
    }
    const response = await startSimulation({ data, type: "random" })
    const logs = await getData({ id: response.data.collection_identifier })


    expect(response.status).toBe(200);
    //check that they are all increaseing in duration 
    const startTime = Date.parse("2021-04-14T19:15:30+0000")
    logs.forEach(element => {
      expect(Date.parse(element.activity_end) > startTime).toBe(true);
    });
  });

})

describe('Test task timing: waiting before activity', () => {
  jest.setTimeout(99999999);
  it('should add a constant time before each event', async () => {
    const data = {
      "startTime": "2021-04-14T19:15:30+0000",
      "tokens": [
        {
          "distribution": {
            "type": "constant",
            "frequency": "PT10M",
            "amount": 1
          },
          "body": {}
        },
      ]
    }
    const response = await startSimulation({ data, type: "constant", when: "before" })
    const logs = await getData({ id: response.data.collection_identifier })

     
    expect(response.status).toBe(200);

    const startTime = Date.parse("2021-04-14T19:15:30+0000")
    logs.forEach(element => {
      //no impact on duration, only waiting period
      expect((element["activity_end"] === element["activity_start"])).toBe(true)
      expect((Date.parse(element["activity_end"]) > startTime)).toBe(true)

    });
  });

  it('should add a constant time before each event', async () => {
    const data = {
      "startTime": "2021-04-14T19:15:30+0000",
      "tokens": [
        {
          "distribution": {
            "type": "constant",
            "frequency": "PT10M",
            "amount": 1
          },
          "body": {}
        },
      ]
    }
    const response = await startSimulation({ data, type: "normal", when: "before" })
    const logs = await getData({ id: response.data.collection_identifier })

 

    expect(response.status).toBe(200);

    const startTime = Date.parse("2021-04-14T19:15:30+0000")
    logs.forEach(element => {
      //no impact on duration, only waiting period
      expect((element["activity_end"] === element["activity_start"])).toBe(true)
      expect((Date.parse(element["activity_end"]) > startTime)).toBe(true)

    });
  });

  it('should add a constant time before each event', async () => {
    const data = {
      "startTime": "2021-04-14T19:15:30+0000",
      "tokens": [
        {
          "distribution": {
            "type": "constant",
            "frequency": "PT10M",
            "amount": 1
          },
          "body": {}
        },
      ]
    }
    const response = await startSimulation({ data, type: "poisson", when: "before" })
    const logs = await getData({ id: response.data.collection_identifier })

   

    expect(response.status).toBe(200);

    const startTime = Date.parse("2021-04-14T19:15:30+0000")
    logs.forEach(element => {
      //no impact on duration, only waiting period
      expect((element["activity_end"] === element["activity_start"])).toBe(true)
      expect((Date.parse(element["activity_end"]) > startTime)).toBe(true)

    });
  });

  it('should add a constant time before each event', async () => {
    const data = {
      "startTime": "2021-04-14T19:15:30+0000",
      "tokens": [
        {
          "distribution": {
            "type": "constant",
            "frequency": "PT10M",
            "amount": 1
          },
          "body": {}
        },
      ]
    }
    const response = await startSimulation({ data, type: "random", when: "before" })
    const logs = await getData({ id: response.data.collection_identifier })

 

    expect(response.status).toBe(200);

    const startTime = Date.parse("2021-04-14T19:15:30+0000")
    logs.forEach(element => {
      //no impact on duration, only waiting period
      expect((element["activity_end"] === element["activity_start"])).toBe(true)
      expect((Date.parse(element["activity_end"]) > startTime)).toBe(true)

    });
  });
})

describe('Test task timing: waiting before activity', () => {
  jest.setTimeout(99999999);
  it('should add a constant time before and during each activity', async () => {
    const data = {
      "startTime": "2021-04-14T19:15:30+0000",
      "tokens": [
        {
          "distribution": {
            "type": "constant",
            "frequency": "PT10M",
            "amount": 1
          },
          "body": {}
        },
      ]
    }
    const response = await startSimulation({ data, type: "constant", when: "beforeDuring" })
    const logs = await getData({ id: response.data.collection_identifier })

     
    expect(response.status).toBe(200);

    const startTime = Date.parse("2021-04-14T19:15:30+0000")
    logs.forEach(element => {       
      expect((Date.parse(element["activity_start"]) > startTime)).toBe(true)
      expect((element["activity_end"] > element["activity_start"])).toBe(true)
    });

    //check actual values
    //should add three minutes from start to first activity start
    //three minutes duration fore ach


  });
})