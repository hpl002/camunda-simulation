const { beforeEach } = require("jest-circus");
const appconfigs = require("../../config")
const axios = require('axios');
const { upload } = require("../helper")
jest.setTimeout(30000);


describe('Test gateways and variables', () => {
    beforeEach(() => {
        // ping service
        const { status } = axios.get(`${appconfigs.controller}/healthz`)
        if (status !== 200) throw new Error("Error while testing: controller or related services are not online")

    });
    test('Process with single exclusive gateway', async () => {
        const { status } = await upload({ modelPath: `${process.env.PWD}/test/gateways/data/exclusive.bpmn`, payload: require(`${process.env.PWD}/test/gateways/data/exclusive.json`) })
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
            expect(activities.length === 4).toBe(true);
            expect(activities.filter(e => ["start", "end"].includes(e)).length === 2).toBe(true);
        });

        // first process should have bene routed to the less than route

        const process1 = response.data[Object.keys(response.data)[0]]
        expect(!!process1.find(e => e.activity_id === "age-lt-20")).toBe(true);
        // second process should have bene routed to the greater than route
        const process2 = response.data[Object.keys(response.data)[1]]
        expect(!!process2.find(e => e.activity_id === "age-gt-20")).toBe(true);
    });

    test('Process execution contains reference to its originating token', async () => {
        const { status } = await upload({ modelPath: `${process.env.PWD}/test/gateways/data/exclusive.bpmn`, payload: require(`${process.env.PWD}/test/gateways/data/exclusive.json`) })
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

    test('Process with parallle gateway', async () => {
        const { status } = await upload({ modelPath: `${process.env.PWD}/test/gateways/data/parallel.bpmn`, payload: require(`${process.env.PWD}/test/gateways/data/parallel.json`) })
        expect(status === 201).toBe(true);

        let config = {
            method: 'post',
            url: `${appconfigs.controller}/start`,
            headers: {},
            data: { "response": "json" }
        };

        const response = await axios(config)
        expect(response.status === 200).toBe(true);
        const key = Object.keys(response.data).pop()
        let data = response.data[key]
        expect(data.length === 5).toBe(true);
        Object.keys(response.data).forEach(key => {
            const activities = response.data[key].map(e => e.activity_id)
            expect(activities.filter(e => ["eat-dinner", "watch-tv"].includes(e)).length === 2).toBe(true);
        });

    });

    test('Process with exclusive gateway, but missing required variables', async () => {
        const { status } = await upload({ modelPath: `${process.env.PWD}/test/gateways/data/no-default-path-exclusive.bpmn`, payload: require(`${process.env.PWD}/test/gateways/data/no-default-path-exclusive.json`) })
        expect(status === 201).toBe(true);

        let config = {
            method: 'post',
            url: `${appconfigs.controller}/start`,
            headers: {},
            data: { "response": "json" }
        };


        try {
            await axios(config)
        } catch (error) {             
            expect(error.response.status === 500).toBe(true);             
            expect(error.response.data.message.includes("Unknown property used in expression: ${someOtherValue}. Cause: Cannot resolve identifier 'someOtherValue'")).toBe(true);
        }
    });
})