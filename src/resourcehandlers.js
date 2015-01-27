/***********************
 ** Handler Functions **
 ***********************
 * 
 * Handlers expect to be called with:
 * $   - A cheerio instance containing the HTML to scan for resources.
 * url - The URL of the original request.
 * The callback parameter will be provided by async to iterate through
 * a series of handler calls.
 */

var log = require('./logger');

module.exports = {
  replaceImages: function ($, url, callback) {
    log.debug('Calling replaceImages handler');
    replaceAll($, 'img', url, 'src', callback);
  },

  replaceCSSFiles: function ($, url, callback) {
    log.debug('Calling replaceCSSFiles handler');
    replaceAll($, 'link[rel="stylesheet"]', url, 'href', callback);
  },

  replaceJSFiles: function ($, url, callback) {
    log.debug('Calling replaceJSFiles handler');
    replaceAll($, 'script', url, 'src', callback);
  }
};
