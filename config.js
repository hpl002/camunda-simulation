module.exports = {
    processEngine: `${process.env.PROCESS_ENGINE_HOST}:${process.env.PROCESS_ENGINE_PORT}`,     
    controller: `http://localhost:${process.env.CONTROLLER_PORT}`,
    mongo: `${process.env.MONGO_HOST}:${process.env.MONGO_PORT}`,
    mongoPing: `http://localhost:${process.env.MONGO_PORT}`,
} 