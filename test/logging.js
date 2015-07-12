var logger = require('../src/logger');

logger.silly('Hello', 'world!');
logger.debug('The value is', 3.141592);
logger.info('cats', 42, 'dogs', 23, 'data', 23232011.8898);
logger.verbose('THIS SURE IS VERBOSE!');
logger.warn('!!! BEWARE !!!');
logger.error('Oh dear.', 'An error occurred! It has been', 10, 'times now!');
