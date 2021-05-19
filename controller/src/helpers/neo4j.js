var neo4j = require('neo4j-driver')
var { logger } = require('../helpers/winston')
var driver = neo4j.driver(process.env.NEO4J_URL, neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD));
var session = driver.session();



const executeQuery = (query) => {
    return session.run(query).then(function (result) {
        logger.log("info", "pulling records from neo4j")
        let records = result.records.map(e => e.get("r"))
        return records
    }).catch((err) => {
        logger.log("error", "eror while pulling records from neo4j")
        console.error(err)
        throw err
    }).finally(() => {
        session.close();
        driver.close();
    })
}


/*  
const pQuery = "MATCH (t:Task {category: 'front-desk'})-[REQUIRES]-(s:Specialization)-[HAS]-(r:Resource) return r"
const s = executeQuery2(pQuery).then((r) => {
    console.log(r)
})
 */




/* (async () => {
    const s = await executeQuery("MATCH (t:Task {category: 'front-desk'})-[REQUIRES]-(s:Specialization)-[HAS]-(r:Resource) return r")
    console.log(s)
})() */

exports.executeQuery = executeQuery;



