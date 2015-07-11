module.exports = function (logger) {
  var helpers = require('./helpers')(logger);
  
  return {
  /* resourceRequest handlers */

  /* resourceRetrieved handlers */

  /**
   * Step into CSS files to bundle url() calls within them
   */
  bundleCSSRecursively: function (request, options, body, diffs, response, callback) {
    var ct = response.headers['content-type'];
    ct = ct ? ct : response.headers['Content-Type'];
    if (typeof ct !== 'undefined' && ct.indexOf('css') >= 0) {
      helpers.replaceAll(request, options.url, helpers.cssReferenceFinder(body), callback);
    } else {
      callback(null, {});
    }
  }
  }; // END OBJECT REUTRN
};   // END MODULE DEFINITION
