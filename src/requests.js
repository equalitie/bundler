/***********************************
 ** Pre-Original-Request Handlers **
 ***********************************
 *
 * Handlers called before making the first request for the original
 * url provided to the bundler.
 * Arguments:
 *   options  - The options object to be passed to `request`.
 *   callback - The iterating callback `async` uses to call the next handler.
 */

var _ = require('lodash');
var log = require('./logger');

module.exports = {
  stripHeaders: function (headers) {
    return function (options, callback) {
      if (!options.hasOwnProperty('headers')) {
        options.headers = {};
      }
      for (var i = 0, len = headers.length; i < len; ++i) {
        options.headers[headers[i]] = '';
      }
      callback(null, options);
    };
  },

  spoofHeaders: function (spoofs) {
    return function (options, callback) {
      if (!options.hasOwnProperty('headers')) {
        options.headers = {};
      }
      _.extend(options.headers, spoofs);
      callback(null, options);
    };
  },

  proxyTo: function (url) {
    return function (options, callback) {
      options.proxy = url;
      callback(null, options);
    };
  }
};
