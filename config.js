module.exports = {
    processEngine: `${process.env.PROCESS_ENGINE_HOST}:${process.env.PROCESS_ENGINE_PORT}`,
    mongo: `${process.env.MONGO_HOST}:${process.env.MONGO_PORT}`,
    mongoHTTP: `http://localhost:${process.env.MONGO_PORT}`,     
    neo4j: `${process.env.NEO4J_HOST}:${process.env.NEO4J_PORT}`,
    neo4j_username: `${process.env.NEO4J_USERNAME}`,
    neo4j_password: `${process.env.NEO4J_PASSWORD}`,
    neo4jHTTP: `http://localhost:${process.env.NEO4J_PORT}`,     
    neo4j: `${process.env.NEO4J_HOST}:${process.env.NEO4J_PORT}`,
    controller: `http://localhost:${process.env.CONTROLLER_PORT}`
}