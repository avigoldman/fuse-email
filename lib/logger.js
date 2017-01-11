'use strict';

const winston = require('winston');
module.exports = function(level) {
  
  const logger = new (winston.Logger)({
    transports: [
      new (winston.transports.Console)({
        level: level
      })
    ]
  });

  return logger;
}