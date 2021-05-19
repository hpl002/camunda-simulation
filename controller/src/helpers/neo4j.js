var neo4j = require('neo4j-driver')
var { logger } = require('../helpers/winston')
var driver = neo4j.driver(process.env.NEO4J_URL, neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD));
var session = driver.session();



const executeQuery = ({query}) => {
    if(!query){
        loggeer.log("error", "Expected a query but got nothing")
        throw new Error("Expected a query but got nothing")
    }  
    return session.run(query).then(function (result) {
        logger.log("info", "pulling records from neo4j")
        let records = result.records.map(e => e.get("r"))
        if(records.length===0) throw new Error("neo4j query did not return any records. Should always return at least one. Query:", query)
        return records
    }).catch((err) => {
        logger.log("error", "eror while pulling records from neo4j. Check log")
        console.error(err)
        throw err
    })
}

const close = () => {
    session.close();
    driver.close();
}


/* (async () => {
    const s = await executeQuery("MATCH (t:Task {category: 'front-desk'})-[REQUIRES]-(s:Specialization)-[HAS]-(r:Resource) return r")
    console.log(s)
})() */

exports.executeQuery = executeQuery;
exports.close = close;



