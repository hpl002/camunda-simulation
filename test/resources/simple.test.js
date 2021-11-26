const { beforeEach } = require("jest-circus");
const appconfigs = require("../../config")
const axios = require('axios');
const { upload } = require("../helper")
jest.setTimeout(30000);


describe('resources', () => {
    beforeEach(() => {
        // ping service
        const { status } = axios.get(`${appconfigs.controller}/healthz`)
        if (status !== 200) throw new Error("Error while testing: controller or related services are not online")

    });

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

        // upload config and task array
        // upload config and task with resource queries(these need to be validated on init)
        // upload config and task with resource queries(very specific queries)
        // upload config and task with resource queries(very generic queries)
        // bug where function that adds and remoced proeprties does not respect LIMIT
        // here we need to use actual record identifiers


        // run simple simulation with no resource efficiency
        // run slightly more comlpex simulation with no resource efficiency(gateway)
        // run slightly more comlpex simulation with no resource efficiency(gateway)
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


    /*
    
    
    
    
    
    
    */






})
