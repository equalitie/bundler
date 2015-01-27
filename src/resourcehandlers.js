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
var request = require('request');
var _ = require('lodash');
var log = require('./logger');
var helpers = require('./helpers');

function replaceAll(options, $, selector, url, attr, callback) {
  var elements = [];
  $(selector).each(function (index, elem) {
    var $_this = $(this);
    elements.push($_this);
  });
  log.info('Found %d resources in %s with selector %s', elements.length, url, selector);
  async.reduce(elements, {}, function (memo, item, next) {
    if (typeof item.attr(attr) === 'undefined') {
      // In the case that we get something like a <script> tag with no
      // source or href to fetch, just skip it.
      next(null, memo);
    } else {
      fetchAndReplace(options, attr, item, memo, url, next);
    }
  }, callback);
}

function fetchAndReplace(options, attr, elem, diff, url, callback) {
  log.debug('options in fetchAndReplace = %j', options);
  var resource = elem.attr(attr);
  // For some reason top-level pages might make it here
  // and we want to break the function before trying to fetch them.
  if (typeof resource === 'undefined' || !resource) {
    log.error('%s accidentally landed in the list of resources to fetch.', url);
    return;
  }
  var resurl = urllib.resolve(url, resource);
  request(options, function (err, response, body) {
    if (err) {
      // Here, the callback is actually the function that continues
      // iterating in async.reduce, so it is imperitive that we call it.
      log.error('request.js failed to fetch %s', url);
      log.error('Error: %s', err.message);
      callback(err, diff);
    } else {
      source = new Buffer(body);
      writeDiff(resource, resurl, source, diff, callback);
    }
  });
}

function writeDiff(resource, resurl, source, diff, callback) {
  var newuri = helpers.dataURI(resurl, source);
  var newDiff = {};
  newDiff[resource] = newuri;
  callback(null, _.extend(diff, newDiff));
}

module.exports = {
  replaceImages: function ($, url, options, callback) {
    log.debug('Calling replaceImages handler');
    replaceAll(options, $, 'img', url, 'src', callback);
  },

  replaceCSSFiles: function ($, url, options, callback) {
    log.debug('Calling replaceCSSFiles handler');
    replaceAll(options, $, 'link[rel="stylesheet"]', url, 'href', callback);
  },

  replaceJSFiles: function ($, url, options, callback) {
    log.debug('Calling replaceJSFiles handler');
    replaceAll(options, $, 'script', url, 'src', callback);
  }
};
