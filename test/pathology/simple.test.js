const { beforeEach } = require("jest-circus");
const appconfigs = require("../../config")
const axios = require('axios');
const { upload } = require("../helper")
const fs = require("fs")

jest.setTimeout(3000000);

const getTime = (data, index) => {
    return data[index].activity_start.split(" ")[1]
}


beforeEach(() => {
    // ping service
    const { status } = axios.get(`${appconfigs.controller}/healthz`)
    if (status !== 200) throw new Error("Error while testing: controller or related services are not online")

});
describe('core', () => {
    describe('upload', () => {
        test('upload config', async () => {
            const { status } = await upload({ modelPath: `${process.env.PWD}/test/pathology/data/model.bpmn`, payload: require(`${process.env.PWD}/test/pathology/data/cytology-1-happy-path.json`) })
            expect(status === 201).toBe(true);
        });
    })

    describe('execute', () => {
        test('Happy path: 1 cytology specimen ', async () => {
            const { status } = await upload({ modelPath: `${process.env.PWD}/test/pathology/data/model.bpmn`, payload: require(`${process.env.PWD}/test/pathology/data/cytology-1-happy-path.json`) })

            expect(status === 201).toBe(true);
            let config = {
                method: 'post',
                url: `${appconfigs.controller}/start`,
                headers: {},
                data: { "response": "json" }
            };

            let response = await axios(config)
            response = Object.values(response.data)
            response = response[0]
            expect(response.length).toEqual(12);
            expect(response.length).toEqual(12);
            expect(response[0]["activity_start"].split(" ")[1]).toEqual("16:00:00");
            expect(response[11]["activity_start"].split(" ")[1]).toEqual("16:00:00");
        });

        test('Happy path: 5 cytology specimen ', async () => {
            const { status } = await upload({ modelPath: `${process.env.PWD}/test/pathology/data/model.bpmn`, payload: require(`${process.env.PWD}/test/pathology/data/cytology-10-happy-path.json`) })

            expect(status === 201).toBe(true);
            let config = {
                method: 'post',
                url: `${appconfigs.controller}/start`,
                headers: {},
                data: { "response": "json" }
            };

            let response = await axios(config)
            let counter = 0
            Object.values(response.data).forEach(element => {
                expect(element.length).toEqual(12);
                expect(element.length).toEqual(12);
                expect(element[0]["activity_start"].split(" ")[1]).toEqual(`16:${counter * 10 === 0 ? "00" : counter * 10}:00`);
                expect(element[11]["activity_start"].split(" ")[1]).toEqual(`16:${counter * 10 === 0 ? "00" : counter * 10}:00`);
                counter += 1
            });
        });
    })

    describe.only('experiments', () => {
        test('experiment 1 - token ingress + local and global variables', async () => {
            // Local and global variables
            // Token ingress 
            const { status } = await upload({ modelPath: `${process.env.PWD}/test/pathology/data/model.bpmn`, payload: require(`${process.env.PWD}/test/pathology/data/experiment1/config.json`) })

            expect(status === 201).toBe(true);
            let config = {
                method: 'post',
                url: `${appconfigs.controller}/start`,
                headers: {},
                data: { "response": "csv" }
            };

            let response = await axios(config)
            //expect(Object.values(response.data).length).toEqual(60);
            expect(response.status).toEqual(200);

            fs.writeFileSync(`${process.env.PWD}/test/pathology/data/experiment1/experiment-1.csv`, response.data);

        });

        test('experiment 2 - token ingress + local and global variables + tak duration', async () => {
            // Local and global variables
            // Token ingress 
            const { status } = await upload({ modelPath: `${process.env.PWD}/test/pathology/data/model.bpmn`, payload: require(`${process.env.PWD}/test/pathology/data/experiment2/config.json`) })

            expect(status === 201).toBe(true);
            let config = {
                method: 'post',
                url: `${appconfigs.controller}/start`,
                headers: {},
                data: { "response": "csv" }
            };

            let response = await axios(config)
            expect(response.status).toEqual(200);
            fs.writeFileSync(`${process.env.PWD}/test/pathology/data/experiment2/experiment-2.csv`, response.data);
        });

        test('experiment 3 - token ingress + local and global variables + tak duration + resources', async () => {
            // Local and global variables
            // Token ingress 
            const { status } = await upload({ modelPath: `${process.env.PWD}/test/pathology/data/model.bpmn`, payload: require(`${process.env.PWD}/test/pathology/data/experiment3/config.json`) })

            expect(status === 201).toBe(true);
            let config = {
                method: 'post',
                url: `${appconfigs.controller}/start`,
                headers: {},
                data: { "response": "csv" }
            };

            let response = await axios(config)
            expect(response.status).toEqual(200);
            fs.writeFileSync(`${process.env.PWD}/test/pathology/data/experiment3/experiment-3.csv`, response.data);
        });

        test('experiment 4 - token ingress + local and global variables + tak duration + resources + resource efficiency', async () => {
            // Local and global variables
            // Token ingress 
            const { status } = await upload({ modelPath: `${process.env.PWD}/test/pathology/data/model.bpmn`, payload: require(`${process.env.PWD}/test/pathology/data/experiment4/config.json`) })

            expect(status === 201).toBe(true);
            let config = {
                method: 'post',
                url: `${appconfigs.controller}/start`,
                headers: {},
                data: { "response": "csv" }
            };

            let response = await axios(config)
            expect(response.status).toEqual(200);
            fs.writeFileSync(`${process.env.PWD}/test/pathology/data/experiment4/experiment-4.csv`, response.data);
        });

        test('experiment 4.1 - token ingress + local and global variables + tak duration + resources + resource efficiency + ingress increased by factor of 1.5', async () => {
            // Local and global variables
            // Token ingress 
            const { status } = await upload({ modelPath: `${process.env.PWD}/test/pathology/data/model.bpmn`, payload: require(`${process.env.PWD}/test/pathology/data/experiment4/15/config.json`) })

            expect(status === 201).toBe(true);
            let config = {
                method: 'post',
                url: `${appconfigs.controller}/start`,
                headers: {},
                data: { "response": "csv" }
            };

            let response = await axios(config)
            expect(response.status).toEqual(200);
            fs.writeFileSync(`${process.env.PWD}/test/pathology/data/experiment4/15/experiment-415.csv`, response.data);
        });

        test.only('experiment 4.2 - token ingress + local and global variables + tak duration + resources + resource efficiency + ingress increased by factor of 2', async () => {
            // Local and global variables
            // Token ingress 
            const { status } = await upload({ modelPath: `${process.env.PWD}/test/pathology/data/model.bpmn`, payload: require(`${process.env.PWD}/test/pathology/data/experiment4/20/config.json`) })

            expect(status === 201).toBe(true);
            let config = {
                method: 'post',
                url: `${appconfigs.controller}/start`,
                headers: {},
                data: { "response": "csv" }
            };

            let response = await axios(config)
            expect(response.status).toEqual(200);
            fs.writeFileSync(`${process.env.PWD}/test/pathology/data/experiment4/20/experiment.csv`, response.data);
        });        
    })


})