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
var log = require('./logger');

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

function makeDiff(request, baseURL, resource, callback) {
  var resourceURL = urllib.resolve(baseURL, resource);
  var options = { url: resourceURL, encoding: null };
  request(options, function (err, response, body) {
    if (err) {
      log.error('Failed to fetch %s. Error: %s', resourceURL, err.message);
      if (err.message.substring(0, 11) === 'Invalid URI') {
        callback(null, response, {});
      } else {
        log.info('Ignoring invalid URL to simply pass resource on as is');
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

function strReplaceAll(string, str1, str2) {
  var index = string.indexOf(str1);
  while (index >= 0) {
    string = string.replace(str1, str2);
    index = string.indexOf(str1, index);
  }
  return string;
}

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

function strReplaceAll(string, str1, str2) {
  var index = string.indexOf(str1);
  while (index >= 0) {
    string = string.replace(str1, str2);
    index = string.indexOf(str1, index);
  }
  return string;
}

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
    log.info('Found %d resources in %s', elementHandlers.length, url);
    async.parallel(elementHandlers, function (err, diffs) {
      if (err) {
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
