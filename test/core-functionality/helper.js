const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const appconfigs = require("../../config")

module.exports = {
    upload: async ({modelPath,payload, options={} }) => {
        let data = new FormData();
        if(!!!options.nofile) data.append('camunda', fs.createReadStream(modelPath));         
        data.append('JSON', JSON.stringify(payload));

        let config = {
            method: 'post',
            url: `${appconfigs.controller}/config`,
            headers: {
                ...data.getHeaders()
            },
            data: data
        };

        try {
            return await axios(config)             
        } catch (err) {
            throw err
        }
    }
}