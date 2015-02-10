/* This module exports functions for manipulating resource requests and
 * functions for manipulating resource contents.
 *
 * Handlers for the former, set on the `resourceRequest` event have the
 * following signature:
 * function handlerName(options, callback, originalDocument, response)
 *
 * Handlers for the latter, set on the `resourceRetrieved` event have
 * the following signature:
 * function handlerName(requestFn, body, response, callback)
 *
 * See the README for more information about these kinds of hooks.
 */

var helpers = require('./helpers');

module.exports = {
  /* resourceRequest handlers */

  /* resourceRetrieved handlers */

  bundleCSSRecursively: function (request, body, response, callback) {
    body = body.toString();
    if (response.headers['content-type'] !== undefined && response.headers['content-type'].indexOf('css') >= 0) {
      helpers.replaceAll(request, response.url, helpers.cssReferenceFinder(body), function (err, diffs) {
        if (err) {
          callback(err, body);
        } else {
          console.log(diffs);
          callback(null, helpers.applyDiffs(body, diffs));
        }
      });
    } else {
      callback(null, body);
    }
  }
};
