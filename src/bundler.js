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

function wrappedRequest(bundler, originalResponse, originalBody) {
  return function (opts, callback) {
    if (typeof opts === 'string') {
      opts = { url : opts };
    }
    async.reduce(bundler.resourceRequestHooks, opts, function (memo, hook, next) {
      hook(memo, next, originalBody, originalResponse);
    }, function (err, options) {
      if (err) {
        log.error('Failed to call a resource request hook. Error: %s', err.mesage);
        bundler.callback(err, null);
      } else {
        request(options, function (err, response, body) {
          if (err) {
            log.error('Failed to call a resource response hook. Error: %s', err.message);
            bundler.callback(err, null);
          } else {
            async.reduce(bundler.resourceResponseHooks, body, function (memoBody, nextHook, iterFn) {
              hook(wrappedRequest(bundler, response, body), memoBody, response, iterFn);
            }, function (error, newBody) {
              callback(error, response, newBody);
            });
          }
        });
      }
    });
  };
}

function replaceResources(bundler, response, body) {
  var makeRequest = function (opts, callback) {
    if (typeof opts === 'string') {
      opts = { url : opts };
    }
    async.reduce(bundler.resourceRequestHooks, opts, function (memo, hook, next) {
      hook(memo, next);
    }, function (err, options) {
      if (err) {
        log.error('Failed to call a resource request hook. Error: %s', err.mesage);
        bundler.callback(err, null);
      } else {
        request(options, callback);
      }
    });
  };
  invokeHandlers(bundler, body, wrappedRequest(bundler, response, body));
}

function invokeHandlers(bundler, originalDoc, requestFn) {
  var handlers = [];
  for (var i = 0, len = bundler.resourceHandlers.length; i < len; ++i) {
    handlers.push(function (index) {
      return function (asynccb) {
        // Instead of passing once-computed options to be reused in each handler,
        // we use our new request function to compute new options every time.
        bundler.resourceHandlers[index](requestFn, originalDoc, bundler.url, asynccb);
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
      log.debug(Object.keys(diffs)[0]);
      handleDiffs(bundler, originalDoc, allDiffs);
    }
  });
}

function handleDiffs(bundler, html, diffs) {
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
