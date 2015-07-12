/**********************
 ** Helper Functions **
 **********************
 *
 * Functions made to assist in writing handlers and hooks.
 */

var urllib = require('url');
var async = require('async');
var _ = require('lodash');
var cheerio = require('cheerio');
var mime = require('mime');
var logger = require('./logger');

/**
 * Produce a Data URI for a given resource.
 * @param {object} response - The response to the request for the document
 * @param {string} url - The URL for the resource requested
 * @param {Buffer} content - The content of the resource
 */
function dataURI(response, url, content) {
  var encoded = content.toString('base64');
  var ct = response.headers['Content-Type'];
  if (typeof ct === 'undefined') {
    ct = response.headers['content-type'];
  }
  if (typeof ct === 'undefined') {
    ct = mimetype(url);
  }
  return 'data:' + ct + ';base64,' + encoded;
}

/**
 * Request a resource, make a Data URI for it, and produce a diff
 * representing that change.
 * @param {function} request - The request function to invoke to get the resource
 * @param {string} baseURL - The base (domain) for the resource URL
 * @param {string} resource - The URI for the resource to request
 * @param {function} callbck - The callback to invoke with error, response, and diff data
 */
function makeDiff(request, baseURL, resource, callback) {
  var resourceURL = urllib.resolve(baseURL, resource);
  var options = { url: resourceURL, encoding: null };
  request(options, function (err, response, body) {
    if (err) {
      logger.error(err.message);
      if (err.message.substring(0, 11) === 'Invalid URI') {
        callback(null, response, {});
      } else {
        callback(err, response, {});
      }
    } else {
      var datauri = dataURI(response, resourceURL, body);
      var diff = {};
      diff[resource] = datauri;
      callback(null, response, diff);
    }
  });
}

/**
 * Replace all instances of one substring with another in a larger string.
 * @param {string} string - The string to replace the substrings in
 * @param {string} str1 - The substring to be replaced
 * @param {string} str2 - The substring to replace str1 with
 */
function strReplaceAll(string, str1, str2) {
  var index = string.indexOf(str1);
  while (index >= 0) {
    string = string.replace(str1, str2);
    index = string.indexOf(str1, index);
  }
  return string;
}

/**
 * Try to determine the mimetype of a resource based on its URI.
 * Defaults to 'text/plain'.
 * @param {string} url - The URI of the resource
 */
function mimetype(url) {
  var i = url.lastIndexOf('.');
  var defaultMT = 'text/plain';
  if (i < 0) {
    return defaultMT;
  }
  var ext = '.' + url.substring(i, url.length);
  ext = ext.match(/\.\w+/);
  if (ext) {
    return mime.lookup(ext[0]);
  }
  return defaultMT;
}

/**
 * Apply a set of diffs to s tring.
 * @param {string} string - The string to have diffs applied to
 * @param {object} diffs - The set of diffs to apply
 */
function applyDiffs(string, diffs) {
  var keys = Object.keys(diffs);
  for (var i = 0, len = keys.length; i < len; ++i) {
    string = strReplaceAll(string, keys[i], diffs[keys[i]]);
  }
  return string;
}

module.exports = {
  makeDiff: makeDiff,
  dataURI: dataURI,
  mimetype: mimetype,
  strReplaceAll: strReplaceAll,
  applyDiffs: applyDiffs,

  /**
   * Produces a function that will invoke a callback with the data read from
   * tags found within a document.
   * @param {string} source - The HTML document to search over
   * @param {string} selector - The CSS selector to find tags
   * @param {string} attr - The attribute to collect data from out of discovered tags
   */
  htmlFinder: function (source, selector, attr) {
    var $ = cheerio.load(source);
    return function (callback) {
      $(selector).each(function (index, elem) {
        var $_this = $(this);
        var resource = $_this.attr(attr);
        if (typeof resource !== 'undefined') {
          callback(resource);
        }
      });
    };
  },

  /**
   * Produces a function that will invoke a callback with all URLs within
   * url() calls in a CSS document or style attribute.
   * @param {string} source - The CSS code to search
   */
  cssReferenceFinder: function (source) {
    return function (callback) {
      var index = source.indexOf('url(');
      while (index >= 0) {
        var i2 = index + 4;
        // Find the end of the declaration then go back to the closing paren.
        while ('; }\n'.indexOf(source.charAt(i2)) < 0) {
          i2++;
        }
        while (source.charAt(i2) !== ')') {
          i2--;
        }
        var uri = strReplaceAll(strReplaceAll(source.substring(index + 4, i2), '"', ''), '\'', '');
        index = source.indexOf('url(', index + 4);
        callback(uri);
      }
    };
  },

  /**
   * Replace all references to particular type of resource with Data URIs.
   * @param {function} request - The request function to invoke to obtain the resource
   * @param {string} url - The URL of the original document requested
   * @param {function} finder - A finder function for collecting references to resources
   * @param {function} callback - A handler to invoke with the resource
   */
  replaceAll: function (request, url, finder, callback) {
    // Prepare functions for parallel invokation.
    var elementHandlers = [];
    finder(function (resource) {
      elementHandlers.push(function (asynccallback) {
        makeDiff(request, url, resource, function (err, response, diff) {
          // TODO - Implement post-resource hooks and call them here.
          // What would they actually do?
          asynccallback(err, diff);
        });
      });
    });
    async.parallel(elementHandlers, function (err, diffs) {
      if (err) {
        logger.error(err.message);
        callback(err, {});
      } else {
        var allDiffs = {};
        for (var i = 0, len = diffs.length; i < len; ++i) {
          allDiffs = _.extend(allDiffs, diffs[i]);
        }
        callback(null, allDiffs);
      }
    });
  }
};
