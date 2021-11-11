module.exports = {
    processEngine: `${process.env.PROCESS_ENGINE_HOST}:${process.env.PROCESS_ENGINE_PORT}`,     
    controller: `http://localhost:${process.env.CONTROLLER_PORT}`
}