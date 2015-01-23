/* This module exports the `makeBundle` function for bundling a web page by
 * inlining resources such as CSS files and images using data URIs.
 * See: https://en.wikipedia.org/wiki/Data_URI_scheme
 * It also exports some common handlers that can be grouped together to
 * replace different resources as well as a couple of functions, namely
 * mimetype and dataURI to help in writing custom handlers.
 */
var _ = require('lodash');
var mime = require('mime');
var async = require('async');
var request = require('request');
var cheerio = require('cheerio');
var winston = require('winston');
var urllib = require('url');
var path = require('path');
var fs = require('fs');

var config = JSON.parse(fs.readFileSync(path.join('config', 'config.json')));

var log = new (winston.Logger)({
  transports: [
    new (winston.transports.File)({
      name: 'infoFile',
      filename: path.join('log', 'info.log'),
      level: 'info'
    }),
    new (winston.transports.File)({
      name: 'errorFile',
      filename: path.join('..', 'log', 'error.log'),
      level: 'error'
    }),
    new (winston.transports.Console)({
      level: 'debug'
    })
  ]
});

function replaceResources(url, html, handlers, callback) {
  var $ = cheerio.load(html);
  var functions = [];
  for (var i = 0, len = handlers.length; i < len; ++i) {
    functions.push(function (index) {
      return function (asynccallback) {
        handlers[index]($, url, asynccallback);
      };
    }(i));
  }
  // The call to `async.parallel` will produce an array of objects mapping
  // resource URLs to their data URIs, so we merge them together here.
  async.parallel(functions, function (err, diffs) {
    if (err) {
      log.error('Error occurred in async.parallel: %s', err.message);
      callback(err, null);
    } else {
      var allDiffs = _.reduce(diffs, _.extend);
      html = applyDiffs(html, allDiffs);
      log.info('Got bundlefor ' + url);
      callback(null, html);
    }
  });
}

var mimetype = function(url) {
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
};

function dataURI(url, content) {
  var encoded = content.toString('base64');
  return 'data:' + mimetype(url) + ';base64,' + encoded;
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

function writeDiff(resource, resurl, source, diff, callback) {
  var newuri = dataURI(resurl, source);
  var newDiff = {};
  newDiff[resource] = newuri;
  callback(null, _.extend(diff, newDiff));
}

function fetchAndReplace(attr, elem, diff, url, callback) {
  var resource = elem.attr(attr);
  // For some reason top-level pages might make it here
  // and we want to break the function before trying to fetch them.
  if (typeof resource === 'undefined' || !resource) {
    log.error('%s accidentally landed in the list of resources to fetch.', url);
    return;
  }
  var resurl = urllib.resolve(url, resource);
  var requestData = {url: resurl};
  request(requestData, function (err, response, body) {
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

function replaceAll($, selector, url, attr, callback) {
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
      fetchAndReplace(attr, item, memo, url, next);
    }
  }, callback);
}

/***********************
 ** Handler Functions **
 ***********************
 * 
 * Handlers expect to be called with:
 * $   - A cheerio instance containing the HTML to scan for resources.
 * url - The URL of the original request.
 * The callback parameter will be provided by async to iterate through
 * a series of handler calls.
 */

function replaceImages($, url, callback) {
  log.debug('Calling replaceImages handler');
  replaceAll($, 'img', url, 'src', callback);
}

function replaceCSSFiles($, url, callback) {
  log.debug('Calling replaceCSSFiles handler');
  replaceAll($, 'link[rel="stylesheet"]', url, 'href', callback);
}

function replaceJSFiles($, url, callback) {
  log.debug('Calling replaceJSFiles handler');
  replaceAll($, 'script', url, 'src', callback);
}

module.exports = {
  mimetype: mimetype,
  dataURI: dataURI,
  replaceImages: replaceImages,
  replaceCSSFiles: replaceCSSFiles,
  replaceJSFiles: replaceJSFiles,

  makeBundle: function (url, handlers, callback) {
    log.info('Got request to bundle %s', url);
    request(url, function (err, response, body) {
      if (err) {
        log.error('Could not fetch %s. Error: %s', url, err.message);
        callback(err, response);
      } else {
        log.info('Beginning bundling process for %s', url);
        replaceResources(url, body, handlers, callback);
      }
    });
  }
};
