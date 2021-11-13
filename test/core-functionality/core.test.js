const { beforeEach } = require("jest-circus");
const appconfigs = require("../../config")
const axios = require('axios');
const { upload } = require("./helper")
const CSV = require('csv-string');


// `${process.send.PWD}/data/test.bpmn`
describe('core functionality', () => {
    beforeEach(() => {
        // ping service
        const { status } = axios.get(`${appconfigs.controller}/healthz`)
        if (status !== 200) throw new Error("Error while testing: controller or related services are not online")

    });

    describe('upload and input validation', () => {

        describe('positive', () => {
            test('upload config', async () => {
                const { status } = await upload({ modelPath: `${process.env.PWD}/data/test.bpmn`, payload: require("./data/payload.json") })
                expect(status === 201).toBe(true);
            });
        })

        describe('negative', () => {
            test('upload invalid config: incorrect token description', async () => {
                let payload = require("./data/payload.json")
                payload = JSON.parse(JSON.stringify(payload))
                delete payload.tokens[0].variables[0].type
                try {
                    await upload({ modelPath: `${process.env.PWD}/data/test.bpmn`, payload })
                } catch (error) {
                    const { status, data } = error.response
                    expect(status === 400).toBe(true);
                    expect(data[0].message === 'requires property "type"').toBe(true);
                }
            });

            test('upload invalid config: missing file', async () => {
                const payload = require("./data/payload.json")
                try {
                    const { status } = await upload({ modelPath: `${process.env.PWD}/data/test.bpmn`, payload: require("./data/payload.json"), payload, options: { nofile: true } })
                } catch (error) {
                    const { status, data } = error.response
                    expect(status === 400).toBe(true);
                    expect(data === 'Missing camunda bpmn file').toBe(true);
                }
            });

            test('upload invalid config: missing file', async () => {
                const payload = require("./data/payload.json")
                try {
                    const { status } = await upload({ modelPath: `${process.env.PWD}/data/payload.json`, payload: require("./data/payload.json"), payload })
                } catch (error) {
                    const { status, data } = error.response
                    expect(status === 400).toBe(true);
                    expect(data === 'camunda: incorrect filetype. Requires .bpmn').toBe(true);
                }
            });
        })


    });

    describe('execute model', () => {
        beforeEach(() => {
            // ping service
            const { status } = axios.get(`${appconfigs.controller}/healthz`)
            if (status !== 200) throw new Error("Error while testing: controller or related services are not online")

        });

        describe('positive', () => {
            test('upload config and exexute simulation: get response as csv', async () => {
                const { status } = await upload({ modelPath: `${process.env.PWD}/data/test.bpmn`, payload: require("./data/payload.json") })
                expect(status === 201).toBe(true);

                let config = {
                    method: 'post',
                    url: `${appconfigs.controller}/start`,
                    headers: {},
                    data: { "response": "csv" }
                };

                const response = await axios(config)
                expect(response.status === 200).toBe(true);

                //try to translate output to csv to ensure that output is indeed correctly formatted
                const parsedCsv = CSV.parse(response.data);
                expect(Array.isArray(parsedCsv)).toBe(true)
            });

            test('upload config and exexute simulation: get response as json', async () => {
                const { status } = await upload({ modelPath: `${process.env.PWD}/data/test.bpmn`, payload: require("./data/payload.json") })
                expect(status === 201).toBe(true);

                let config = {
                    method: 'post',
                    url: `${appconfigs.controller}/start`,
                    headers: {},
                    data: { "response": "json" }
                };

                const isObject = (obj) => {
                    return obj === Object(obj);
                }


                const response = await axios(config)
                expect(response.status === 200).toBe(true);
                expect(isObject(response.data)).toBe(true)
            });
        })

        describe('negative', () => {
            test('upload config and exexute simulation: invalid response type', async () => {
                const { status } = await upload({ modelPath: `${process.env.PWD}/data/test.bpmn`, payload: require("./data/payload.json") })
                expect(status === 201).toBe(true);

                let config = {
                    method: 'post',
                    url: `${appconfigs.controller}/start`,
                    headers: {},
                    data: { "response": "valueNotInEnum" }
                };


                try {
                    await axios(config)
                } catch (error) {
                    expect(error.response.status === 400).toBe(true);

                }


                //try to translate output to csv to ensure that output is indeed correctly formatted
            });

        })
    });

})