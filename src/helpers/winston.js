const winston = require('winston');

var logLevels = {
  levels: {
      trace: 0,
      debug: 1,
      info: 2,
      mongo: 3,
      neo4j: 4,
      process: 5,
      warn: 6,
      error: 7,
      critical: 7
  }
};

const logger = winston.createLogger({
  levels: logLevels.levels,   
  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),



  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'mongo.log', level: 'mongo' }),
    new winston.transports.File({ filename: 'neo4j.log', level: 'neo4j' }),
    new winston.transports.File({ filename: 'process.log', level: 'process' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({ format: winston.format.json(), level: 'error'})
  ],
});


exports.logger = logger;
