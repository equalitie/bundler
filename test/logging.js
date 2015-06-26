var logging = require('../src/logger');

var logger = new logging.Logger({
  threshold: logging.LogLevels.silly,
  default: {
    outputs: [logging.stdoutWriter()],
    formatter: logging.formatLine
  },
  info: {
    outputs: [logging.stdoutWriter(), logging.fileWriter('info.log')],
    formatter: logging.formatJSON
  },
  error: {
    outputs: [logging.stderrWriter(), logging.fileWriter('error.log')],
    formatter: logging.formatLine
  }
});

logger.silly('Hello', 'world!');
logger.debug('The value is', 3.141592);
logger.info('cats', 42, 'dogs', 23, 'data', 23232011.8898);
logger.verbose('THIS SURE IS VERBOSE!');
logger.warning('!!! BEWARE !!!');
logger.error('Oh dear.', 'An error occurred! It has been', 10, 'times now!');

logger.destroy();
