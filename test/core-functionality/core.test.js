const { beforeEach } = require("jest-circus");
const appconfigs = require("../../config")
const axios = require('axios');
const { upload } = require("../helper")
const CSV = require('csv-string');
jest.setTimeout(30000);


describe('core functionality', () => {
    beforeEach(() => {
        // ping service
        const { status } = axios.get(`${appconfigs.controller}/healthz`)
        if (status !== 200) throw new Error("Error while testing: controller or related services are not online")

    });

    describe('upload and input validation', () => {

        describe('positive', () => {
            test('upload config', async () => {
                const { status } = await upload({ modelPath: `${process.env.PWD}/test/core-functionality/data/test.bpmn`, payload: require(`${process.env.PWD}/test/core-functionality/data/payload.json`) })
                expect(status === 201).toBe(true);
            });

            test('upload config with model that has no service tasks', async () => {
                const { status } = await upload({ modelPath: `${process.env.PWD}/test/core-functionality/data/test-no-service.bpmn`, payload: require(`${process.env.PWD}/test/core-functionality/data/payload.json`) })
                expect(status === 201).toBe(true);
            });

            test('upload config with neo4j query', async () => {
                const { status } = await upload({ modelPath: `${process.env.PWD}/test/core-functionality/data/test.bpmn`, payload: require(`${process.env.PWD}/test/core-functionality/data/payload_neo4j.json`) })
                expect(status === 201).toBe(true);
            });
        })

        describe('negative', () => {
            test('upload invalid config: incorrect token description', async () => {
                let payload = require(`${process.env.PWD}/test/core-functionality/data/payload.json`)
                payload = JSON.parse(JSON.stringify(payload))
                delete payload.tokens[0].variables[0].type
                try {
                    await upload({ modelPath: `${process.env.PWD}/test/core-functionality/data/test.bpmn`, payload })
                } catch (error) {
                    const { status, data } = error.response
                    expect(status === 400).toBe(true);
                }
            });

            test('upload invalid config: missing file', async () => {
                let payload = require(`${process.env.PWD}/test/core-functionality/data/payload.json`)
                try {
                    await upload({ modelPath: `${process.env.PWD}/test/core-functionality/data/test.bpmn`, payload, options: { nofile: true } })
                } catch (error) {
                    const { status, data } = error.response
                    expect(status === 400).toBe(true);
                    expect(data === 'Missing camunda bpmn file').toBe(true);
                }
            });

            test('upload invalid config: valid file but invalid filetype', async () => {
                let payload = require(`${process.env.PWD}/test/core-functionality/data/payload.json`)
                try {
                    const { status } = await upload({ modelPath: `${process.env.PWD}/test/core-functionality/data/payload.json`, payload, payload })
                } catch (error) {
                    const { status, data } = error.response
                    expect(status === 400).toBe(true);
                    expect(data === 'camunda: incorrect filetype. Requires .bpmn').toBe(true);
                }
            });
        })


    });

    describe('execute model', () => {

        describe('positive', () => {
            test('upload config and exexute simulation: get response as csv', async () => {
                const { status } = await upload({ modelPath: `${process.env.PWD}/test/core-functionality/data/test.bpmn`, payload: require(`${process.env.PWD}/test/core-functionality/data/payload.json`) })
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
                const { status } = await upload({ modelPath: `${process.env.PWD}/test/core-functionality/data/test.bpmn`, payload: require(`${process.env.PWD}/test/core-functionality/data/payload.json`) })
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
                const { status } = await upload({ modelPath: `${process.env.PWD}/test/core-functionality/data/test.bpmn`, payload: require(`${process.env.PWD}/test/core-functionality/data/payload.json`) })
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

    describe('check produced log', () => {
        test('check log of very simple execution with 2 tokens', async () => {
            const { status } = await upload({ modelPath: `${process.env.PWD}/test/core-functionality/data/task/single-task.bpmn`, payload: require(`${process.env.PWD}/test/core-functionality/data/task/2-tokens-payload.json`) })
            expect(status === 201).toBe(true);

            let config = {
                method: 'post',
                url: `${appconfigs.controller}/start`,
                headers: {},
                data: { "response": "json" }
            };

            const response = await axios(config)
            expect(response.status === 200).toBe(true);
            expect(Object.keys(response.data).length === 2).toBe(true);
            Object.keys(response.data).forEach(key => {
                const activities = response.data[key].map(e => e.activity_id)
                expect(activities.length === 3).toBe(true);
                expect(activities.filter(e => ["start", "end"].includes(e)).length === 2).toBe(true);
            });
        });

        test('check log of very simple execution with 20 tokens', async () => {
            const { status } = await upload({ modelPath: `${process.env.PWD}/test/core-functionality/data/task/single-task.bpmn`, payload: require(`${process.env.PWD}/test/core-functionality/data/task/20-tokens-payload.json`) })
            expect(status === 201).toBe(true);

            let config = {
                method: 'post',
                url: `${appconfigs.controller}/start`,
                headers: {},
                data: { "response": "json" }
            };

            const response = await axios(config)
            expect(response.status === 200).toBe(true);
            expect(Object.keys(response.data).length === 20).toBe(true);
            Object.keys(response.data).forEach(key => {
                const activities = response.data[key].map(e => e.activity_id)
                expect(activities.length === 3).toBe(true);
                expect(activities.filter(e => ["start", "end"].includes(e)).length === 2).toBe(true);
            });
        });

        test('check log of very simple execution with 200 tokens', async () => {
            const { status } = await upload({ modelPath: `${process.env.PWD}/test/core-functionality/data/task/single-task.bpmn`, payload: require(`${process.env.PWD}/test/core-functionality/data/task/200-tokens-payload.json`) })
            expect(status === 201).toBe(true);

            let config = {
                method: 'post',
                url: `${appconfigs.controller}/start`,
                headers: {},
                data: { "response": "json" }
            };

            const response = await axios(config)
            expect(response.status === 200).toBe(true);
            expect(Object.keys(response.data).length === 200).toBe(true);
            Object.keys(response.data).forEach(key => {
                const activities = response.data[key].map(e => e.activity_id)
                expect(activities.length === 3).toBe(true);
                expect(activities.filter(e => ["start", "end"].includes(e)).length === 2).toBe(true);
            });
        });

        test('log entry contains reference to its originating token', async () => {
            const { status } = await upload({ modelPath: `${process.env.PWD}/test/core-functionality/data/task/single-task.bpmn`, payload: require(`${process.env.PWD}/test/core-functionality/data/task/2-tokens-payload.json`) })
            expect(status === 201).toBe(true);

            let config = {
                method: 'post',
                url: `${appconfigs.controller}/start`,
                headers: {},
                data: { "response": "json" }
            };

            const response = await axios(config)
            expect(response.status === 200).toBe(true);
            expect(Object.keys(response.data).length === 2).toBe(true);

            const events = []

            Object.keys(response.data).forEach(id => {
                events.push(...response.data[id])
            });

            events.forEach(event => {
                expect(!!event.token_id).toBe(true);
            });
        });
    });

})