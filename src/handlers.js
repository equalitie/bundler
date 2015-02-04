/***********************
 ** Handler Functions **
 ***********************
 * 
 * Handlers expect to be called with:
 * $        - A cheerio instance containing the HTML to scan for resources.
 * url      - The URL of the original request.
 * callback - Iteration callback provided by async.parallel
 * The callback parameter will be provided by async to iterate through
 * a series of handler calls.
 */

var urllib = require('url');
var async = require('async');
var _ = require('lodash');
var log = require('./logger');
var helpers = require('./helpers');

function replaceAll(request, $, selector, url, attr, callback) {
  // Prepare functions for parallel invokation.
  var elementHandlers = [];
  $(selector).each(function (index, elem) {
    var $_this = $(this);
    if (typeof $_this.attr(attr) !== 'undefined') {
      elementHandlers.push(function (item) {
        return function (asynccallback) {
          fetchAndReplace(request, attr, item, url, asynccallback);
        };
      }($_this));
    }
  });
  log.info('Found %d resources in %s with selector %s', elementHandlers.length, url, selector);
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

function fetchAndReplace(request, attr, elem, url, callback) {
  var resource = elem.attr(attr);
  // For some reason top-level pages might make it here
  // and we want to break the function before trying to fetch them.
  if (typeof resource === 'undefined' || !resource) {
    log.error('%s accidentally landed in the list of resources to fetch.', url);
    return;
  }
  var resurl = urllib.resolve(url, resource);
  var options = { url: resurl };
  request(options, function (err, response, body) {
    if (err) {
      log.error('request.js failed to fetch %s', url);
      log.error('Error: %s', err.message);
      callback(err, {});
    } else {
      source = new Buffer(body);
      var datauri = helpers.dataURI(resurl, source);
      var diff = {};
      diff[resource] = datauri;
      callback(null, diff);
    }
  });
}

module.exports = {
  replaceImages: function (request, $, url, callback) {
    log.debug('Calling replaceImages handler');
    replaceAll(request, $, 'img', url, 'src', callback);
  },

  replaceCSSFiles: function (request, $, url, callback) {
    log.debug('Calling replaceCSSFiles handler');
    replaceAll(request, $, 'link[rel="stylesheet"]', url, 'href', callback);
  },

  replaceJSFiles: function (request, $, url, callback) {
    log.debug('Calling replaceJSFiles handler');
    replaceAll(request, $, 'script', url, 'src', callback);
  }
};
