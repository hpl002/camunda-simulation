const { beforeEach } = require("jest-circus");
const appconfigs = require("../../config")
const axios = require('axios');
const { upload } = require("../helper")
jest.setTimeout(30000);

const getTime = (data, index) => {
    return data[index].activity_start.split(" ")[1]
}


beforeEach(() => {
    // ping service
    const { status } = axios.get(`${appconfigs.controller}/healthz`)
    if (status !== 200) throw new Error("Error while testing: controller or related services are not online")

});
describe('core', () => {
    describe('resources', () => {

        describe('positive', () => {
            //upload config 
            test('upload config with neo4j query - simply create graph', async () => {
                const { status } = await upload({ modelPath: `${process.env.PWD}/test/resources/data/common/cook-pizza.bpmn`, payload: require(`${process.env.PWD}/test/resources/data/positive/config-no-task.json`) })
                expect(status === 201).toBe(true);
            });

            test('upload config with neo4j query and task array- simply create graph', async () => {
                const { status } = await upload({ modelPath: `${process.env.PWD}/test/resources/data/common/cook-pizza.bpmn`, payload: require(`${process.env.PWD}/test/resources/data/positive/config-single-task.json`) })
                expect(status === 201).toBe(true);
            });
        })

        describe('negative', () => {
            // upload config and task with resource queries(these need to be validated on init)
            test('upload config with neo4j query and a corresponding task with resource query that does not resolve to anything', async () => {
                try {
                    await upload({ modelPath: `${process.env.PWD}/test/resources/data/common/deliver-pizza.bpmn`, payload: require(`${process.env.PWD}/test/resources/data/negative/config.json`) })
                    throw new Error("the upload should have thrown an error before this. Check validation")
                } catch (error) {
                    expect(error.response.data === "Could not find any hits for resource query").toBe(true);
                }
            });
        })
    })
})

describe('simulation', () => {

    test('simple process with a single resource that has a set efficiency', async () => {
        // process with single task and single token
        // task har deps on resoruce with 50% efficiency
        const { status } = await upload({ modelPath: `${process.env.PWD}/test/resources/data/common/cook-pizza.bpmn`, payload: require(`${process.env.PWD}/test/resources/data/simulation/single-tokens-with-efficiency.json`) })
        expect(status === 201).toBe(true);


        let config = {
            method: 'post',
            url: `${appconfigs.controller}/start`,
            headers: {},
            data: { "response": "json" }
        };

        let response = await axios(config)
        expect(response.status === 200).toBe(true);
        response = Object.values(response.data)

        expect(getTime(response[0], 0) === "16:00:00").toBe(true);
        expect(getTime(response[0], 1) === "16:00:00").toBe(true);
        expect(getTime(response[0], 2) === "16:15:00").toBe(true);
    })

    test('rescheduling: activities are rescheduled due to the resource being occupied', async () => {
        const { status } = await upload({ modelPath: `${process.env.PWD}/test/resources/data/common/cook-pizza.bpmn`, payload: require(`${process.env.PWD}/test/resources/data/simulation/multiple-tokens-no-efficiency.json`) })
        expect(status === 201).toBe(true);


        let config = {
            method: 'post',
            url: `${appconfigs.controller}/start`,
            headers: {},
            data: { "response": "json" }
        };

        let response = await axios(config)
        expect(response.status === 200).toBe(true);

        response = Object.values(response.data)

        expect(getTime(response[0], 0) === "16:00:00").toBe(true);// enter 
        expect(getTime(response[0], 1) === "16:00:00").toBe(true);// start activity
        expect(getTime(response[0], 2) === "16:10:00").toBe(true);// exit


        expect(getTime(response[1], 0) === "16:05:00").toBe(true);
        expect(getTime(response[1], 1) === "16:10:00").toBe(true);
        expect(getTime(response[1], 2) === "16:20:00").toBe(true);


        expect(getTime(response[2], 0) === "16:10:00").toBe(true);
        expect(getTime(response[2], 1) === "16:20:00").toBe(true);
        expect(getTime(response[2], 2) === "16:30:00").toBe(true);
    });

    test('rescheduling+efficiency: activities are rescheduled due to the resource being occupied', async () => {
        const { status } = await upload({ modelPath: `${process.env.PWD}/test/resources/data/common/cook-pizza.bpmn`, payload: require(`${process.env.PWD}/test/resources/data/simulation/multiple-tokens-with-efficiency.json`) })
        expect(status === 201).toBe(true);


        let config = {
            method: 'post',
            url: `${appconfigs.controller}/start`,
            headers: {},
            data: { "response": "json" }
        };

        let response = await axios(config)
        expect(response.status === 200).toBe(true);

        response = Object.values(response.data)

        expect(getTime(response[0], 0) === "16:00:00").toBe(true);
        expect(getTime(response[0], 1) === "16:00:00").toBe(true);
        expect(getTime(response[0], 2) === "16:15:00").toBe(true);


        expect(getTime(response[1], 0) === "16:05:00").toBe(true);
        expect(getTime(response[1], 1) === "16:15:00").toBe(true);
        expect(getTime(response[1], 2) === "16:30:00").toBe(true);


        expect(getTime(response[2], 0) === "16:10:00").toBe(true);
        expect(getTime(response[2], 1) === "16:30:00").toBe(true);
        expect(getTime(response[2], 2) === "16:45:00").toBe(true);
    });


})


            // test the cypher limit proeprties

            // upload config and task with resource queries(very specific queries)
            // upload config and task with resource queries(very generic queries)
            // bug where function that adds and remoced proeprties does not respect LIMIT
            // here we need to use actual record identifiers


            // run simple simulation with no resource efficiency
            // run slightly more comlpex simulation with no resource efficiency(gateway)
            // run slightly more comlpex simulation with no resource efficiency(gateway)

