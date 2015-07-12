var winston = require('winston');
var logConfig = require('../config/logger');

// Initialize transports with a console transport.
var transports = [new (winston.transports.Console)({ level: logConfig.threshold })];

// Add file transports for every level for which there is a filename provided.
for (var i = 0, len = logConfig.logFiles.length; i < len; i++) {
  var fileCfg = logConfig.logFiles[i];
  transports.push(new (winston.transports.File)({
    name: fileCfg.level + '-file',
    filename: fileCfg.filename,
    level: fileCfg.level
  }));
}

// Export a logger for any module that `requires` this to use.
module.exports = new (winston.Logger)({ transports: transports });
