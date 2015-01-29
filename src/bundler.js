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
var requests = require('./requests');
var handlers = require('./handlers');
var resources = require('./resources');
var diffs = require('./diffs');
var helpers = require('./helpers');
var log = require('./logger');

function Bundler(url) {
  this.url = url;
  this.resourceHandlers = new Array(); 
  this.originalRequestHooks = new Array(); 
  this.resourceRequestHooks = new Array(); 
  this.diffHooks = new Array();
  this.callback = function () {};
  return this;
}

Bundler.prototype.on = function (hookname, handler) {
  switch (hookname) {
  case 'originalRequest':
    this.originalRequestHooks.push(handler);
    break;
  case 'originalReceived':
    this.resourceHandlers.push(handler);
    break;
  case 'resourceRequest':
    this.resourceRequestHooks.push(handler);
    break;
  case 'diffsReceived':
    this.diffHooks.push(handler);
    break;
  default:
    log.error('No hook with the name %s exists.', hookname);
  }
  return this;
};

Bundler.prototype.bundle = function (callback) {
  this.callback = callback;
  var initOptions = { url: this.url };
  var thisBundler = this;
  async.reduce(this.originalRequestHooks, initOptions, function (memo, hook, next) {
    log.debug('in Bundler.send/async.reduce, memo =', memo);
    hook(memo, next);
  }, function (err, options) {
    log.debug('in send, options = %j', options);
    if (err) {
      log.error('Error calling pre-initial-request hooks; Error: %s', err.message);
      this.callback(err, null);
    } else {
      makeBundle(thisBundler, options);
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
  async.reduce(bundler.resourceRequestHooks, {}, function (memo, hook, next) {
    // Call the hook with arguments in the same order that the request modifier hooks
    // expect them to come in so that they could be reused here just as well.
    hook(memo, next, $, response);
  }, function (err, options) {
    log.debug('in replaceResources/async.reduce, options = %j', options);
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
        log.debug('Before calling handler, options = %j', options);
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
      log.info('Got diffs for %s', bundler.url);
      log.log('debug', 'allDiffs = %j', allDiffs);
      handleDiffs(bundler, $.html(), allDiffs);
    }
  });
}

function handleDiffs(bundler, html, diffs) {
  log.debug('Called handleDiffs to replace resource URLs with data URIs.');
  async.reduce(bundler.diffHooks, diffs, function (memo, hook, next) {
    hook(memo, next);
  }, function (err, newDiffs) {
    if (err) {
      log.error('Error calling post-resources hooks; Error: %s', err.message);
      bundler.callback(err, null);
    } else {
      log.info('Applying diffs to HTML.');
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

module.exports = {
  Bundler: Bundler
};

_.extend(module.exports, helpers);
_.extend(module.exports, requests);
_.extend(module.exports, handlers);
_.extend(module.exports, resources);
_.extend(module.exports, diffs);
