/***********************
 ** Handler Functions **
 ***********************
 *
 * Handlers expect to be called with:
 * $        - A cheerio instance containing the HTML to scan for resources.
 * url      - The URL of the original request.
 * callback - Iteration callback provided by async.parallel
 * The callback parameter will be provided by async to iterate through
 * a series of handler calls.
 */

var log = require('./logger');
var helpers = require('./helpers');

module.exports = {
  replaceImages: function (request, originalDoc, url, callback) {
    helpers.replaceAll(request, url, helpers.htmlFinder(originalDoc, 'img', 'src'), callback);
  },

  replaceCSSFiles: function (request, originalDoc, url, callback) {
    helpers.replaceAll(request, url, helpers.htmlFinder(originalDoc, 'link[rel="stylesheet"]', 'href'), callback);
  },

  replaceJSFiles: function (request, originalDoc, url, callback) {
    helpers.replaceAll(request, url, helpers.htmlFinder(originalDoc, 'script', 'src'), callback);
  }
};
