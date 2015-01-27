/* This module exports the `makeBundle` function for bundling a web page by
 * inlining resources such as CSS files and images using data URIs.
 * See: https://en.wikipedia.org/wiki/Data_URI_scheme
 * It also exports some common handlers that can be grouped together to
 * replace different resources as well as a couple of functions, namely
 * mimetype and dataURI to help in writing custom handlers.
 */
 
var _ = require('lodash');
var async = require('async');
var request = require('request');
var cheerio = require('cheerio');
var urllib = require('url');
var path = require('path');
var fs = require('fs');
var requestModifiers = require('./requestmodifiers');
var resources = require('./resourcehandlers');
var beforeResource = require('./preresourcehooks');
var postResource = require('./postresourcehooks');
var helpers = require('./helpers');
var log = require('./logger');

var config = JSON.parse(fs.readFileSync(path.join('config', 'config.json')));

var Bundler = function (url) {
  this.url = url;
  this.resourceHandlers = [];
  this.preInitHooks = [];
  this.preResourcesHooks = [];
  this.postResourcesHooks = [];
  this.callback = function () {};
};

Bundler.prototype.useHandler = function (handler) {
  this.resourceHandlers.push(handler);
  return this;
};

Bundler.prototype.beforeOriginalRequest = function (hook) {
  this.preInitHooks.push(hook);
  return this;
};

Bundler.prototype.beforeFetchingResources = function (hook) {
  this.preResourcesHooks.push(hook);
  return this;
};

Bundler.prototype.afterFetchingResources = function (hook) {
  this.postResourcesHooks.push(hook);
  return this;
};

Bundler.prototype.send = function (callback) {
  this.callback = callback;
  var initOptions = request.defaults({url: this.url});
  async.reduce(this.preInitHooks, initOptions, function (memo, hook, next) {
    hook(memo, next);
  }, function (err, options) {
    if (err) {
      log.error('Error calling pre-initial-request hooks; Error: %s', err.message);
      this.callback(err, null);
    } else {
      makeBundle(this, options);
    }
  });
}

function makeBundle(bundler, options) {
  request(options, function (err, res, body) {
    if (err) {
      log.error('Error making request to %s; Error: %s', bundler.url, err.message);
      bundler.callback(err, null);
    } else {
      replaceResources(bundler, res, body);
    }
  });
}

function replaceResources(bundler, response, body) {
  var $ = cheerio.load(body);
  async.reduce(this.preResourcesHooks, {}, function (memo, hook, next) {
    // Call the hook with arguments in the same order that the request modifier hooks
    // expect them to come in so that they could be reused here just as well.
    hook(memo, hook, $, response);
  }, function (err, options) {
    if (err) {
      log.error('Error calling pre-resource-handler hooks; Error: %s', err.message);
      bundler.callback(err, null);
    } else {
      invokeHandlers(bundler, $, options);
    }
  });
}

function invokeHandlers(bundler, $, options) {
  var handlers = [];
  for (var i = 0, len = bundler.resourceHandlers.length; i < len; ++i) {
    handlers.push(function (index) {
      return function (asynccb) {
        bundler.resourceHandlers[index]($, bundler.url, options, asynccb);
      };
    }(i));
  }
  async.parallel(handlers, function (err, diffs) {
    if (err) {
      log.error('Error calling resource handler; Error: %s', err.message);
      bundler.callback(err, null);
    } else {
      var allDiffs = _.reduce(diffs, _.extend);
      log.info('Got bundle for %s', bundler.url);
      handleDiffs(bundler, $.html(), allDiffs);
    }
  });
}

function handleDiffs(bundler, html, diffs) {
  async.reduce(bundler.postResourcesHooks, diffs, function (memo, hook, next) {
    hook(diffs, next);
  }, function (err, newDiffs) {
    if (err) {
      log.error('Error calling post-resources hooks; Error: %s', err.message);
      bundler.callback(err, null);
    } else {
      html = applyDiffs(html, newDiffs);
      bundler.callback(null, html);
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
  var headerData = {headers: config.spoofHeaders};
  for (var i = 0, len = config.doNotForwardHeaders.length; i < len; ++i) {
    headerData.headers[config.doNotForwardHeaders[i]] = '';
  }
  log.debug('URL: %s', resurl);
  log.debug('Header data: %j', headerData);
  request({url: resurl, headers: headerData}, function (err, response, body) {
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

module.exports = {
  helpers: helpers,
  modifyRequest: requestModifiers,
  resources: resources,
  changeRequestBehavior: preResource,
  modifyReplacements: postResource,
  Bundler: Bundler
};

