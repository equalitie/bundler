/***********************************
 ** Pre-Original-Request Handlers **
 ***********************************
 *
 */

var _ = require('lodash');

module.exports = {
  /**
   * Remove a set of headers from a request by setting their values to empty strings.
   * @param {[string]} - An array of header names to remove
   */
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

  /**
   * Spoof a set of headers with specific values.
   * @param {object} spoofs - An object mapping header names to their spoofed values
   */
  spoofHeaders: function (spoofs) {
    return function (options, callback) {
      if (!options.hasOwnProperty('headers')) {
        options.headers = {};
      }
      _.extend(options.headers, spoofs);
      callback(null, options);
    };
  },

  /**
   * Configure a request to use a proxy.
   * @param {string} url - The URL of the proxy server
   */
  proxyTo: function (url) {
    return function (options, callback) {
      options.proxy = url;
      callback(null, options);
    };
  },

  /**
   * Instruct request to follow redirects to some degree.
   * @param {boolean} first - Whether to follow the first request
   * @param {boolean} all - Whether to follow all requests
   * @param {int} limit - The maximum number of redirects to follow
   */
  followRedirects: function (first, all, limit) {
    return function (options, callback) {
      options.followRedirect = first;
      options.followAllRedirects = all;
      options.maxRedirects = limit;
      callback(null, options);
    };
  }
};
