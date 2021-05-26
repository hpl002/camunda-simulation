var neo4j = require('neo4j-driver')
var { logger } = require('../helpers/winston')
var driver = neo4j.driver(process.env.NEO4J_URL, neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD), { disableLosslessIntegers: true });



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


/* (async () => {
    const s = await executeQuery("MATCH (t:Task {category: 'front-desk'})-[REQUIRES]-(s:Specialization)-[HAS]-(r:Resource) return r")
    console.log(s)
})() */

exports.executeQuery = executeQuery;
exports.close = close;



