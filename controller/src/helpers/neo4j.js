var neo4j = require('neo4j-driver')
const configs = require("../../../config")


const init = () => {
    return neo4j.driver(configs.neo4j, neo4j.auth.basic(configs.neo4j_username, configs.neo4j_password), { disableLosslessIntegers: true });
}

const executeQuery = async ({ query, driver }) => {
    if (!query) {
        console.log("error", "Expected a query but got nothing")
        throw new Error("Expected a query but got nothing")
    }
    console.log("neo4j", `running query against neo4j: ${query}`)
    var session = driver.session();
    try {
        const result = await session.run(query)
        console.log("neo4j", `num records returned:${result.records.length}`)
        session.close({ driver });
        return {records:result.records}
    } catch (error) {
        console.log("error", `error on query: ${query}`)
        console.error(error)
        session.close({ driver });
        throw err
    }
}

const close = async ({ driver }) => {
    await driver.close();
}


module.exports = {
    executeQuery,
    close,
    init
}
