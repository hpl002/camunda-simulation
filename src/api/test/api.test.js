const axios = require('axios');
const FormData = require('form-data');
const appConfigs = require("../../../config")
const fs  = require("fs")
const path  = require("path")

describe('/config - uploading configs', () => {
    test('try to upload invalid config', async () => {
        let data = new FormData();
        data.append('JSON', '{\n  "tokens": [\n    {\n      "frequency": 27,\n      "variables": [\n        {"value": "aute adipisicing enim esse"\n        },\n        {\n          "name": "culpa et consectetur adipisicing",\n          "value": "quis fugiat"\n        },         \n        {\n          "name": "enim Ut adipisicing elit Lorem",\n          "value": "in"\n        },\n        {\n          "name": "labore in",\n          "value": "non aliquip nulla exercitation laboris"\n        }\n      ],\n      "id": "irure"\n    },\n    {\n      "frequency": 48,\n      "variables": [\n        {\n          "name": "proident magna",\n          "value": "consectetur adipisicing"\n        },\n        {\n          "name": "et",\n          "value": "esse Lorem"\n        },\n        {\n          "name": "pariatur nostrud ut sit anim",\n          "value": "ad ullamco ut"\n        }\n      ],\n      "id": "occaecat Duis Excepteur laborum culpa"\n    },\n    {\n      "frequency": 26,\n      "variables": [\n        {\n          "name": "Lorem culpa",\n          "value": "consectetur"\n        },\n        {\n          "name": "ea aliquip cupidatat aute non",\n          "value": "culpa deserunt Excepteur sit"\n        },\n        {\n          "name": "ut do",\n          "value": "officia do"\n        },\n        {\n          "name": "enim ut consectetur",\n          "value": "qui cillum velit Excepteur"\n        },\n        {\n          "name": "dolore",\n          "value": "ipsum adipisicing"\n        }\n      ],\n      "id": "do officia elit consectetur incididunt"\n    }\n  ]\n}', {contentType: 'application/json'});

        let config = {
            method: 'post',
            url: `${appConfigs.controller}/config`,
            headers: {
                ...data.getHeaders()
            },
            data: data
        };

        try {
            await axios(config)
        } catch (error) {
            expect(error.response.status).toEqual(400)
            expect(!!error.response.data[0].name).toEqual(true)
        }
    })

    test('try to upload valid config but missing camunda: .bpmn file', async () => {
        let data = new FormData();
        data.append('JSON', '{\n  "tokens": [\n    {\n      "frequency": 27,\n      "variables": [\n        {\n          "name": "nostrud ut",\n          "value": "aute adipisicing enim esse"\n        },\n        {\n          "name": "culpa et consectetur adipisicing",\n          "value": "quis fugiat"\n        },         \n        {\n          "name": "enim Ut adipisicing elit Lorem",\n          "value": "in"\n        },\n        {\n          "name": "labore in",\n          "value": "non aliquip nulla exercitation laboris"\n        }\n      ],\n      "id": "irure"\n    },\n    {\n      "frequency": 48,\n      "variables": [\n        {\n          "name": "proident magna",\n          "value": "consectetur adipisicing"\n        },\n        {\n          "name": "et",\n          "value": "esse Lorem"\n        },\n        {\n          "name": "pariatur nostrud ut sit anim",\n          "value": "ad ullamco ut"\n        }\n      ],\n      "id": "occaecat Duis Excepteur laborum culpa"\n    },\n    {\n      "frequency": 26,\n      "variables": [\n        {\n          "name": "Lorem culpa",\n          "value": "consectetur"\n        },\n        {\n          "name": "ea aliquip cupidatat aute non",\n          "value": "culpa deserunt Excepteur sit"\n        },\n        {\n          "name": "ut do",\n          "value": "officia do"\n        },\n        {\n          "name": "enim ut consectetur",\n          "value": "qui cillum velit Excepteur"\n        },\n        {\n          "name": "dolore",\n          "value": "ipsum adipisicing"\n        }\n      ],\n      "id": "do officia elit consectetur incididunt"\n    }\n  ]\n}', {contentType: 'application/json'});

        let config = {
            method: 'post',
            url: `${appConfigs.controller}/config`,
            headers: {
                ...data.getHeaders()
            },
            data: data
        };

        try {
            await axios(config)
        } catch (error) {
            expect(error.response.status).toEqual(400)
            expect(error.response.data).toEqual('Missing camunda bpmn file')
        }
    })

    test('try to upload valid config and valid bpmn', async () => {
        let data = new FormData();
         
        data.append('camunda', fs.createReadStream(path.resolve(__dirname, './data/test.bpmn')));
        data.append('JSON', '{\n  "tokens": [\n    {\n      "frequency": 27,\n      "variables": [\n        {\n          "name": "nostrud ut",\n          "value": "aute adipisicing enim esse"\n        },\n        {\n          "name": "culpa et consectetur adipisicing",\n          "value": "quis fugiat"\n        },         \n        {\n          "name": "enim Ut adipisicing elit Lorem",\n          "value": "in"\n        },\n        {\n          "name": "labore in",\n          "value": "non aliquip nulla exercitation laboris"\n        }\n      ],\n      "id": "irure"\n    },\n    {\n      "frequency": 48,\n      "variables": [\n        {\n          "name": "proident magna",\n          "value": "consectetur adipisicing"\n        },\n        {\n          "name": "et",\n          "value": "esse Lorem"\n        },\n        {\n          "name": "pariatur nostrud ut sit anim",\n          "value": "ad ullamco ut"\n        }\n      ],\n      "id": "occaecat Duis Excepteur laborum culpa"\n    },\n    {\n      "frequency": 26,\n      "variables": [\n        {\n          "name": "Lorem culpa",\n          "value": "consectetur"\n        },\n        {\n          "name": "ea aliquip cupidatat aute non",\n          "value": "culpa deserunt Excepteur sit"\n        },\n        {\n          "name": "ut do",\n          "value": "officia do"\n        },\n        {\n          "name": "enim ut consectetur",\n          "value": "qui cillum velit Excepteur"\n        },\n        {\n          "name": "dolore",\n          "value": "ipsum adipisicing"\n        }\n      ],\n      "id": "do officia elit consectetur incididunt"\n    }\n  ]\n}', {contentType: 'application/json'});

        let config = {
            method: 'post',
            url: `${appConfigs.controller}/config`,
            headers: {
                ...data.getHeaders()
            },
            data: data
        };
        const {status} = await axios(config)
        expect(status).toEqual(201)

         
    })
})

