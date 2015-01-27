/********************
 ** Bundler Logger **
 ********************
 */

var winston = require('winston');

module.exports = new (winston.Logger)({
  transports: [
    new (winston.transports.File)({
      name: 'infoFile',
      filename: path.join('log', 'info.log'),
      level: 'info'
    }),
    new (winston.transports.File)({
      name: 'errorFile',
      filename: path.join('..', 'log', 'error.log'),
      level: 'error'
    }),
    new (winston.transports.Console)({
      level: 'debug'
    })
  ]
});
