var helpers = require('./helpers');

module.exports = {
  /* resourceRequest handlers */

  /* resourceRetrieved handlers */

  /**
   * Step into CSS files to bundle url() calls within them
   */
  bundleCSSRecursively: function (request, options, body, diffs, response, callback) {
    var ct = response.headers['content-type'];
    ct = ct ? ct : response.headers['Content-Type'];
    // Make sure we're actually looking at a CSS file and that it hasn't been fetched already.
    // This prevents infinite recursion from occurring in mutually recursive self-importing
    // CSS documents.
    if (typeof ct !== 'undefined' && ct.indexOf('css') >= 0 && !(options.url in diffs)) {
      helpers.replaceAll(request, options.url, helpers.cssReferenceFinder(body), callback);
    } else {
      callback(null, {});
    }
  }
};
