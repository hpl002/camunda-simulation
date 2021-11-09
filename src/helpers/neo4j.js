var neo4j = require('neo4j-driver')
var { logger } = require('../helpers/winston')
const appConfigs = require("../../config")
var driver = neo4j.driver(appConfigs.neo4j, neo4j.auth.basic(appConfigs.neo4j_username, appConfigs.neo4j_password), { disableLosslessIntegers: true });



const executeQuery = ({query}) => {
    var session = driver.session();
    if(!query){
        logger.log("error", "Expected a query but got nothing")
        throw new Error("Expected a query but got nothing")
    } 
    logger.log("neo4j", `running query against neo4j: ${query}`) 
    return session.run(query)
    .then(function (result) {
        logger.log("neo4j", `num records returned:${result.records.length}`)
        return result.records
    }).catch((err) => {
        logger.log("error", `error on query: ${query}`)
        console.error(err)
        throw err
    }).finally(()=>{
        session.close();
    })
}

const close = () => {     
    driver.close();
}

exports.executeQuery = executeQuery;
exports.close = close;



