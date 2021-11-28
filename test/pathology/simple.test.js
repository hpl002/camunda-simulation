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
    })

    test.only('Happy path: 5 cytology specimen ', async () => {
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
            expect(element[0]["activity_start"].split(" ")[1]).toEqual(`16:${counter*10===0?"00":counter*10}:00`);
            expect(element[11]["activity_start"].split(" ")[1]).toEqual(`16:${counter*10===0?"00":counter*10}:00`);
            counter += 1
        });
    });

    
})






            // run slightly more comlpex simulation with no resource efficiency(gateway)
            // run slightly more comlpex simulation with no resource efficiency(gateway)

