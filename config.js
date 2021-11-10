module.exports = {
    processEngine: `${process.env.PROCESS_ENGINE_HOST}:${process.env.PROCESS_ENGINE_PORT}`,
    mongo: `${process.env.MONGO_HOST}:${process.env.MONGO_PORT}`,
    mongoHTTP: `http://localhost:${process.env.MONGO_PORT}`,     
    controller: `http://localhost:${process.env.CONTROLLER_PORT}`
}