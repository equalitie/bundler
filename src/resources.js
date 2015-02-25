var helpers = require('./helpers');

module.exports = {
  /* resourceRequest handlers */

  /* resourceRetrieved handlers */

  bundleCSSRecursively: function (request, options, body, diffs, response, callback) {
    var ct = response.headers['content-type'];
    ct = ct ? ct : response.headers['Content-Type'];
    if (typeof ct !== 'undefined' && ct.indexOf('css') >= 0) {
      helpers.replaceAll(request, options.url, helpers.cssReferenceFinder(body), callback);
    } else {
      callback(null, {});
    }
  }
};
