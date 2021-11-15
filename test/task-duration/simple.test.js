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
    test('Spawn two tokens at 10 min interval. Task has a single task with a 30 min interval', async () => {
        const { status } = await upload({ modelPath: `${process.env.PWD}/test/task-duration/data/constant/simple.bpmn`, payload: require(`${process.env.PWD}/test/task-duration/data/constant/simple.json`) })
        expect(status === 201).toBe(true);

        let config = {
            method: 'post',
            url: `${appconfigs.controller}/start`,
            headers: {},
            data: { "response": "json" }
        };

        let {data} = await axios(config)
        data = Object.values(data)
        const getTime = (index) => {
            return Array.from(new Set(data[index].map(e=>e.activity_start)))[0].split(" ")[1]
        }
        expect(getTime(0) === '16:00:00').toBe(true);
       
    });     
/* 
    test('Spawn tokens at 10 min interval with normal distribution. 10 min mean with 2 min sd.  From 16:00 and onwards. 7 tokens in total', async () => {
        const { status } = await upload({ modelPath: `${process.env.PWD}/test/task-duration/data/normal-distribution/simple.bpmn`, payload: require(`${process.env.PWD}/test/task-duration/data/normal-distribution/simple.json`) })
        expect(status === 201).toBe(true);

        let config = {
            method: 'post',
            url: `${appconfigs.controller}/start`,
            headers: {},
            data: { "response": "json" }
        };

        let {data} = await axios(config)
        data = Object.values(data)
        const getTime = (index) => {
            return Array.from(new Set(data[index].map(e=>e.activity_start)))[0].split(" ")[1]
        }
        expect(getTime(0) === '16:00:00').toBe(true);
        expect(parseInt(getTime(0).split(":")[1]) < parseInt(getTime(1).split(":")[1])).toBe(true);
        expect(parseInt(getTime(2).split(":")[1]) < parseInt(getTime(3).split(":")[1])).toBe(true);
        expect(parseInt(getTime(3).split(":")[1]) < parseInt(getTime(4).split(":")[1])).toBe(true);
        expect(parseInt(getTime(4).split(":")[1]) < parseInt(getTime(5).split(":")[1])).toBe(true);                  
    });  */
})