var neo4j = require('neo4j-driver')
const configs = require("../../../config")
const driver = neo4j.driver(configs.neo4j, neo4j.auth.basic(configs.neo4j_username, configs.neo4j_password), { disableLosslessIntegers: true });


const executeQuery = ({ query }) => {
    var session = driver.session();
    if (!query) {
        console.log("error", "Expected a query but got nothing")
        throw new Error("Expected a query but got nothing")
    }
    console.log("neo4j", `running query against neo4j: ${query}`)
    return session.run(query)
        .then(function (result) {
            console.log("neo4j", `num records returned:${result.records.length}`)
            return result.records
        }).catch((err) => {
            console.log("error", `error on query: ${query}`)
            console.error(err)
            throw err
        }).finally(() => {
            session.close();
        })
}

const close = async () => {
    await driver.close();
}


module.exports = {
    executeQuery,
    close
}
