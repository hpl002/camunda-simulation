/*

test random distribution on ingress
test random distribution on task duration


*/

const { beforeEach } = require("jest-circus");
const appconfigs = require("../../config")
const axios = require('axios');
const { upload } = require("../helper")
jest.setTimeout(30000);


describe('Test token ingress distribution', () => {

    beforeEach(() => {
        // ping service
        const { status } = axios.get(`${appconfigs.controller}/healthz`)
        if (status !== 200) throw new Error("Error while testing: controller or related services are not online")

    });

    test('Spawn two tokens at random interval that is between 1 and 10 min. Task has a single task with a 30 min constant interval', async () => {
        const { status } = await upload({ modelPath: `${process.env.PWD}/test/random-distribution/data/simple.bpmn`, payload: require(`${process.env.PWD}/test/random-distribution/data/simple.json`) })
        expect(status === 201).toBe(true);

        let config = {
            method: 'post',
            url: `${appconfigs.controller}/start`,
            headers: {},
            data: { "response": "json" }
        };

        let { data } = await axios(config)
        data = Object.values(data)


        const getTime = (data, index) => {
            return data[index].activity_start.split(" ")[1]
        }
        const process0 = data[0]
        const process1 = data[1]

        const getMinute = (s) => {
            return parseInt(s.split(":")[1])
        }

        expect(getMinute(getTime(process0, 0))).toBe(0)         

        expect(getMinute(getTime(process1, 0))).toBeGreaterThanOrEqual(1)
        expect(getMinute(getTime(process1, 0))).toBeLessThan(10)
    });

    test('Spawn two tokens at constant 10 min interval. Process has a single task with a random interval between 10 and 30', async () => {
        const { status } = await upload({ modelPath: `${process.env.PWD}/test/random-distribution/data/simple.bpmn`, payload: require(`${process.env.PWD}/test/random-distribution/data/simple_task.json`) })
        expect(status === 201).toBe(true);

        let config = {
            method: 'post',
            url: `${appconfigs.controller}/start`,
            headers: {},
            data: { "response": "json" }
        };

        let { data } = await axios(config)
        data = Object.values(data)


        const getTime = (data, index) => {
            return data[index].activity_start.split(" ")[1]
        }
        const process0 = data[0]
        const process1 = data[1]

        const getMinute = (s) => {
            return parseInt(s.split(":")[1])
        }

        expect(getMinute(getTime(process0, 0))).toBe(0)         
        expect(getMinute(getTime(process0, 1))).toBe(0)       
        expect(getMinute(getTime(process0, 2))).toBe(0)         
        expect(getMinute(getTime(process0, 3))).toBeGreaterThanOrEqual(10)
        expect(getMinute(getTime(process0, 3))).toBeLessThanOrEqual(30)

        expect(getMinute(getTime(process1, 0))).toBe(10)         
        expect(getMinute(getTime(process1, 1))).toBe(10)       
        expect(getMinute(getTime(process1, 2))).toBe(10)         
        expect(getMinute(getTime(process1, 3))).toBeGreaterThanOrEqual(20)
        expect(getMinute(getTime(process1, 3))).toBeLessThanOrEqual(40)
    });

    //'Spawn two tokens at consant interval task duration is random'
})