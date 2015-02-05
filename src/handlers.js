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
var cheerio = require('cheerio');
var log = require('./logger');
var helpers = require('./helpers');

function htmlFinder(url, source, selector, attr) {
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
}

function replaceAll(request, url, finder, callback) {
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

function makeDiff(request, baseURL, resource, callback) {
  var resourceURL = urllib.resolve(baseURL, resource);
  var options = { url: resourceURL, encoding: null };
  request(options, function (err, response, body) {
    if (err) {
      log.error('Failed to fetch %s. Error: %s', resourceURL, err.message);
      callback(err, response, {});
    } else {
      var datauri = helpers.dataURI(resourceURL, body);
      var diff = {};
      diff[resource] = datauri;
      callback(null, response, diff);
    }
  });
}

module.exports = {
  replaceImages: function (request, originalDoc, url, callback) {
    log.debug('Calling replaceImages handler');
    replaceAll(request, url, htmlFinder(url, originalDoc, 'img', 'src'), callback);
  },

  replaceCSSFiles: function (request, originalDoc, url, callback) {
    log.debug('Calling replaceCSSFiles handler');
    replaceAll(request, url, htmlFinder(url, originalDoc, 'link[rel="stylesheet"]', 'href'), callback);
  },

  replaceJSFiles: function (request, originalDoc, url, callback) {
    log.debug('Calling replaceJSFiles handler');
    replaceAll(request, url, htmlFinder(url, originalDoc, 'script', 'src'), callback);
  }
};
