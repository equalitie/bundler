/***********************
 ** Handler Functions **
 ***********************
 *
 * Handlers expect to be called with:
 * The callback parameter will be provided by async to iterate through
 * a series of handler calls.
 */

var async = require('async');
var urllib = require('url');
var helpers = require('./helpers');

module.exports = {
  /**
   * Wrap a regular handler like replaceImages in a predicated handler so that it is only
   * invoked if the predicate (a function of the original document and url of the resource)
   * returns true.
   * @param {function} predicate - The predicate function to test whether to handle the resource
   * @param {function} handler - The handler to invoke when the predicate passes
   */
  predicated: function (predicate, handler) {
    return function (request, originalDoc, url, callback) {
      if (predicate(originalDoc, url)) {
        handler(request, originalDoc, url, callback);
      } else {
        // Continue down the chain of handlers.
        callback(null, {});
      }
    };
  },

  /**
   * Replace the images in a document with Data-URIs.
   */
  replaceImages: function (request, originalDoc, url, callback) {
    helpers.replaceAll(request, url, helpers.htmlFinder(originalDoc, 'img', 'src'), callback);
  },

  /**
   * Replace the CSS file references with Data-URIs.
   */
  replaceCSSFiles: function (request, originalDoc, url, callback) {
    helpers.replaceAll(request, url, helpers.htmlFinder(originalDoc, 'link[rel="stylesheet"]', 'href'), callback);
  },

  /**
   * Replace the JS file references with Data-URIs.
   */
  replaceJSFiles: function (request, originalDoc, url, callback) {
    helpers.replaceAll(request, url, helpers.htmlFinder(originalDoc, 'script', 'src'), callback);
  },

  /**
   * Replace links in a document with the string produced by a function passed
   * 1. The original URL requested
   * 2. The URI of the anchor tag being inspected
   * @param {function} replacer - The function invoked to produce replacements for URIs.
   */
  replaceLinks: function (replacer) {
    return function (request, originalDoc, url, callback) {
      var diffs = {};
      helpers.htmlFinder(originalDoc, 'a', 'href')(function (href) {
        var replacement = replacer(url, href);
        if (typeof replacement !== 'undefined' && replacement !== null) {
          diffs[href] = replacement;
        }
      });
      callback(null, diffs);
    };
  },

  /**
   * Replace the URIs in CSS `url()` calls
   */
  replaceURLCalls: function (request, originalDoc, url, callback) {
    var urlCalls = [];
    helpers.htmlFinder(originalDoc, '*', 'style')(function (style) {
      var index = style.indexOf('url(');
      if (index < 0) {
        return;
      }
      var i2 = index + 4;
      while ('; }\n'.indexOf(style.charAt(i2)) < 0) {
        i2++;
      }
      while (style.charAt(i2) !== ')') {
        i2--;
      }
      var urlVal = style.substring(index + 4, i2);
      urlCalls.push(helpers.strReplaceAll(helpers.strReplaceAll(urlVal, '"', ''), '\'', ''));
    });
    async.reduce(urlCalls, {}, function (memo, nextURL, iter) {
      helpers.makeDiff(request, url, nextURL, function (err, res, diff) {
        iter(err, diff);
      });
    }, callback);
  }
};
