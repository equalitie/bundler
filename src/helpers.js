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

module.exports = {
  mimetype: function (url) {
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
  },

  dataURI: function (url, content) {
    var encoded = content.toString('base64');
    return 'data:' + this.mimetype(url) + ';base64,' + encoded;
  },

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

  replaceAll: function (request, url, finder, callback) {
    // Prepare functions for parallel invokation.
    var elementHandlers = [];
    finder(function (resource) {
      elementHandlers.push(function (asynccallback) {
        this.makeDiff(request, url, resource, function (err, response, diff) {
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
  },

  makeDiff: function (request, baseURL, resource, callback) {
    var resourceURL = urllib.resolve(baseURL, resource);
    var options = { url: resourceURL, encoding: null };
    request(options, function (err, response, body) {
      if (err) {
        log.error('Failed to fetch %s. Error: %s', resourceURL, err.message);
        callback(err, response, {});
      } else {
        var datauri = this.dataURI(resourceURL, body);
        var diff = {};
        diff[resource] = datauri;
        callback(null, response, diff);
      }
    });
  }
};
