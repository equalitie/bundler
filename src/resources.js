var helpers = require('./helpers');
var log = require('./logger');

module.exports = {
  /* resourceRequest handlers */

  /* resourceRetrieved handlers */

  bundleCSSRecursively: function (request, body, diffs, response, callback) {
    log.info('Calling bundleCSSRecursively');
    var ct = response.headers['content-type'];
    ct = ct ? ct : response.headers['Content-Type'];
    if (typeof ct !== 'undefined' && ct.indexOf('css') >= 0) {
      log.debug('Found text/css content type.');
      helpers.replaceAll(request, response.url, helpers.cssReferenceFinder(body), callback);
    } else {
      log.debug('Found content-type %s in bundleCSSRecursively', ct);
      callback(null, {});
    }
  }
};
