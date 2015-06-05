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
  /* Wrap a regular handler like replaceImages in a predicated handler so that it is only
   * invoked if the predicate (a function of the original document and url of the resource)
   * returns true.
   */
  predicated: function (predicate, handler) {
    console.log('Predicate');
    console.log(predicate.toString());
    return function (request, originalDoc, url, callback) {
      console.log('URL = ' + url);
      if (predicate(originalDoc, url)) {
        console.log('Predicate passed!');
        handler(request, originalDoc, url, callback);
      } else {
        // Continue down the chain of handlers.
        console.log('Predicate failed');
        callback(null, {});
      }
    };
  },

  replaceImages: function (request, originalDoc, url, callback) {
    helpers.replaceAll(request, url, helpers.htmlFinder(originalDoc, 'img', 'src'), callback);
  },

  replaceCSSFiles: function (request, originalDoc, url, callback) {
    helpers.replaceAll(request, url, helpers.htmlFinder(originalDoc, 'link[rel="stylesheet"]', 'href'), callback);
  },

  replaceJSFiles: function (request, originalDoc, url, callback) {
    helpers.replaceAll(request, url, helpers.htmlFinder(originalDoc, 'script', 'src'), callback);
  },

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
