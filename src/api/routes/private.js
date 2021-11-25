const fsExtra = require('fs-extra');
const { validate } = require("../validator");
const appConfigs = require("../../../config");
const axios = require('axios');
const fs = require("fs")
var FormData = require('form-data');

var xml2js = require('xml2js');
var parser = new xml2js.Parser();
var builder = new xml2js.Builder();
const neo4j = require("../../../controller/src/helpers/neo4j")

const writeBPMN = ({ sourceFile, targetDir }) => {
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir);
    }

    fs.copyFile(sourceFile, `${targetDir}/simulation.bpmn`, (err) => {
        if (err) throw err;
    });
}

const validateReqAgainstSchema = ({ data, res, schema }) => {
    let payload = data
    if (!!(typeof payload !== 'string' || (payload instanceof String)) === true) {
        payload = JSON.stringify(payload)
    }
    payload = payload.replace(/(\r\n|\n|\r)/gm, "");

    try {
        payload = JSON.parse(payload)
    } catch (error) {
        return res.status(400).send("invlaid payload")
    }
    const validation = validate({ data: payload, schema })
    return validation.errors
}
module.exports = {
    validateReqAgainstSchema,

    validateReq: ({ req, res, schema }) => {
        if (!req.body["JSON"]) return res.status(400).send("missing JSON payload")
        //if any newlines in string then remove these 
        const err = validateReqAgainstSchema({ data: req.body["JSON"], res, schema })
        if (err.length > 0) {
            console.log(err);
            return res.status(400).send(err)
        }

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
        const helper = class {
            constructor({ name, value, type, refresh = false }) {
                this.name = name;
                this.value = value;
                this.type = type;
                this.refresh = refresh;
            }
        }
        payload.tokens.forEach(token => {
            const newPayload = {}
            if (token && token.variables && token.variables.length > 0) {
                token.variables.forEach(variable => {
                    newPayload[variable.name] = new helper({ ...variable })
                });
            }
            token.variables = newPayload
        });

        const formatGlobalVariables = (variables) => {
            const newPayload = {}
            variables.forEach(variable => {
                newPayload[variable.name] = new helper({ ...variable })
            });
            payload.variables = newPayload
        }


        if (payload.variables) formatGlobalVariables(payload.variables)

        //store payload         
        fs.writeFileSync(`${dir}/payload.json`, JSON.stringify(payload, null, 4));
    },
    /**
     * @param  {} {dir}
     * change all regular tasks to service tasks
     */
    parseAndUpdateConfig: async ({ dir }) => {
        const parseModel = async (string) => {
            return parser.parseStringPromise(string).then(function (result) {
                return result;
            }).catch((error) => {
                logger.log("error", error)
                throw new Error("Failed while parsing xml string to js")
            })
        }

        const changeAllTasksToServiceTask = (xml, ids) => {
            xml["bpmn:definitions"]["bpmn:process"][0]["bpmn:task"].forEach(element => {
                element["$"]["camunda:topic"] = "topic"
                element["$"]["camunda:type"] = "external"
            })
            if (xml["bpmn:definitions"]["bpmn:process"][0]["bpmn:serviceTask"]) {
                xml["bpmn:definitions"]["bpmn:process"][0]["bpmn:serviceTask"] = [...xml["bpmn:definitions"]["bpmn:process"][0]["bpmn:serviceTask"], ...xml["bpmn:definitions"]["bpmn:process"][0]["bpmn:task"]]
            }
            else {
                xml["bpmn:definitions"]["bpmn:process"][0]["bpmn:serviceTask"] = xml["bpmn:definitions"]["bpmn:process"][0]["bpmn:task"]
            }
            delete xml["bpmn:definitions"]["bpmn:process"][0]["bpmn:task"]
        }

        const getAllServiceTaskIds = (xml) => {
            const final = []
            const tasks = xml["bpmn:definitions"]["bpmn:process"][0]["bpmn:serviceTask"]
            tasks.forEach(task => {
                final.push(task["$"].id)
            });
            return final
        }

        // read xml from file to string
        let xml = fs.readFileSync(`${dir}/simulation.bpmn`, "utf8")

        // parse xml to js
        xml = await parseModel(xml)

        changeAllTasksToServiceTask(xml)

        const ids = getAllServiceTaskIds(xml)

        // parse js to xml
        xml = builder.buildObject(xml);

        // store xml
        xml = fs.writeFileSync(`${dir}/simulation.bpmn`, xml)

        return { serviceTaskIds: ids }

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

            const { status, data } = await axios(config)
            let id = Object.keys(data.deployedProcessDefinitions).pop().split(":").shift()
            if (status !== 200) throw new Error("failed while trying to upload bpmn model to camunda")
            return { id }
        },

        delete: async () => {
            const getDeployment = async () => {
                let { data } = await axios.get(`${appConfigs.processEngine}/engine-rest/deployment`)
                return { data }
            }
            let { data } = await getDeployment()
            for (const deployment of data) {
                const { status } = await axios.delete(`${appConfigs.processEngine}/engine-rest/deployment/${deployment.id}?cascade=true`)
                if (status !== 204) throw new Error("failed while trying to delete deployment from camunda")
            }
        }
    }
}