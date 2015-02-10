/**********************
 ** Helper Functions **
 **********************
 *
 * Functions made to assist in writing handlers and hooks.
 */

var urllib = require('url');
var async = require('async');
var css = require('css');
var _ = require('lodash');
var cheerio = require('cheerio');
var mime = require('mime');
var log = require('./logger');

function makeDiff(request, baseURL, resource, callback) {
  var resourceURL = urllib.resolve(baseURL, resource);
  var options = { url: resourceURL, encoding: null };
  request(options, function (err, response, body) {
    if (err) {
      log.error('Failed to fetch %s. Error: %s', resourceURL, err.message);
      callback(err, response, {});
    } else {
      var datauri = dataURI(resourceURL, body);
      var diff = {};
      diff[resource] = datauri;
      callback(null, response, diff);
    }
  });
}

function dataURI(url, content) {
  var encoded = content.toString('base64');
  return 'data:' + mimetype(url) + ';base64,' + encoded;
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
          log.debug('Calling callback for handling selector %s', selector);
          callback(resource);
        }
      });
    };
  },

  cssReferenceFinder: function (source) {
    var tree = css.parse(source);
    return function (callback) {
      var rules = tree.stylesheet.rules;
      for (var i = 0, len = rules.length; i < len; ++i) {
        var declarations = rules[i].declarations;
        if (typeof declarations === 'undefined') {
          continue;
        }
        for (var j = 0, len2 = declarations.length; j < len2; ++j) {
          var value = declarations[j].value;
          if (value.substring(0, 4) === 'url(') {
            // TODO: Split the string on spaces to get all the url references that might appear
            var start = 4;
            var end = value.split(' ')[0].lastIndexOf(')');
            var uri = strReplaceAll(value.substring(start, end), '"', '');
            log.info('Found uri %s', uri);
            callback(uri);
          }
        }
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
        log.debug('Type of allDiffs = %s', typeof allDiffs);
        log.debug(Object.keys(allDiffs)[0]);
        callback(null, allDiffs);
      }
    });
  }
};
