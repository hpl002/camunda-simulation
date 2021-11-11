const fsExtra = require('fs-extra');
const { validate } = require("../validator");
const appConfigs = require("../../../config");
const axios = require('axios');
const fs = require("fs")
var FormData = require('form-data');

const writeBPMN = ({ sourceFile, targetDir }) => {
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir);
    }

    fs.copyFile(sourceFile, `${targetDir}/simulation.bpmn`, (err) => {
        if (err) throw err;
    });
}

module.exports = {
    validateReq: ({ req, res }) => {
        const schema = require("../schemas/upload-config.json")
        if (!req.body["JSON"]) return res.status(400).send("missing JSON payload")
        //if any newlines in string then remove these 
        let payload = req.body["JSON"].replace(/(\r\n|\n|\r)/gm, "");

        try {
            payload = JSON.parse(payload)
        } catch (error) {
            return res.status(400).send("invlaid payload")
        }
        const validation = validate({ data: payload, schema })
        if (validation.errors && validation.errors.length > 0) return res.status(400).send(validation.errors)

        if (!req?.files?.camunda) {
            return res.status(400).send("Missing camunda bpmn file")
        }
        if (req.files.camunda.name.split(".")[1].toUpperCase() !== "BPMN") {
            return res.status(400).send("camunda: incorrect filetype. Requires .bpmn")
        }
    },

    deleteAndStoreConfigs: ({ dir, req }) => {
        // wipe all files in local working dir
        fsExtra.emptyDirSync(dir)

        //store bpmn
        writeBPMN({ sourceFile: req.files.camunda.tempFilePath, targetDir: dir })

        let payload = req.body["JSON"].replace(/(\r\n|\n|\r)/gm, "");
        payload = JSON.parse(payload)

        // fix formatting of variables to aligh with what camunda expects.
        // defining anon objects in json schema is a hassle, we therefore fix this on our end instead
        const helper = class{
            constructor({name, value}){
                this.name = name;
                this.value = value
            }
        }
        payload.tokens.forEach(token => {
            const newPayload = {}
            token.variables.forEach(variable => {
                newPayload[variable.name] = new helper({...variable})
            });
            token.variables = newPayload
        });

        //store payload         
        fs.writeFileSync(`${dir}/payload.json`, JSON.stringify(payload, null, 4));
    },

    camunda: {
        upload: async ({ dir }) => {
            //body to readstream
            var form = new FormData()
            form.append('deployment-name', 'aName', { contentType: 'text/plain' });
            form.append('enable-duplicate-filtering', 'true');
            form.append('deployment-source', 'simulation-controller');
            form.append('data', fs.createReadStream(`${dir}/simulation.bpmn`));

            var config = {
                method: 'post',
                url: `${appConfigs.processEngine}/engine-rest/deployment/create`,
                headers: {
                    ...form.getHeaders()
                },
                data: form
            };

            const {status, data} = await axios(config)             
            let id = Object.keys(data.deployedProcessDefinitions).pop().split(":").shift()
            if(status !== 200) throw new Error("failed while trying to upload bpmn model to camunda")
            return {id}
        },

        delete: async () => {
            const getDeployment = async () => {
                let { data } = await axios.get(`${appConfigs.processEngine}/engine-rest/deployment`)
                return { data }
            }
            let { data } = await getDeployment()
            for (const deployment of data) {
                await axios.delete(`${appConfigs.processEngine}/engine-rest/deployment/${deployment.id}?cascade=true`)
            }
        }
    }
}