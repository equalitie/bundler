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
  this.resourceReceivedHooks = new Array();
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
  case 'resourceReceived':
    this.resourceReceivedHooks.push(handler);
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
  var initOptions = {
      url: this.url,
      strictSSL: false,
      rejectUnauthorized: false
  };
  var thisBundler = this;
  if (typeof this.url === 'undefined') {
    callback(new Error('No URL provided to bundler.'), null);
  } else {
    async.reduce(this.originalRequestHooks, initOptions, function (memo, hook, next) {
      log.debug('Calling originalRequest hook with options ', memo);
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
}

function makeBundle(bundler, options) {
  request(options, function (err, res, body) {
    if (err) {
      log.error('Error making request to %s; Error: %s %s', bundler.url, err.stack, err.message);
      bundler.callback(err, null);
    } else {
      invokeHandlers(bundler, body, wrappedRequest(bundler, res, body));
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
        options.encoding = null;
        request(options, function (err, response, body) {
          if (err) {
            log.error('Failed to call a resource response hook. Error: %s', err.message);
            bundler.callback(err, null);
          } else {
            var contentType = response.headers['content-type'];
            contentType = contentType ? contentType : response.headers['Content-Type'];
            if (typeof contentType !== 'undefined' && contentType.indexOf('image') >= 0) {
              callback(null, response, body);
            } else {
              body = body.toString();

              async.reduce(bundler.resourceReceivedHooks, {}, function (memoDiffs, nextHook, iterFn) {
                nextHook(wrappedRequest(bundler, response, body), options, body, memoDiffs, response, iterFn);
              }, function (error, diffs) {
                if (error) {
                  log.error('Error calling resourceReceivedHooks; Error: %s', error.message);
                  callback(error, response, body);
                } else {
                  var newBody = helpers.applyDiffs(body, diffs);
                  callback(null, response, new Buffer(newBody));
                }
              });

            }
          }
        });
      }
    });
  };
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
      html = helpers.applyDiffs(html, newDiffs);
      bundler.callback(null, html);
    }
  });
}

module.exports = {
  Bundler: Bundler
};

_.extend(module.exports, helpers);
_.extend(module.exports, requests);
_.extend(module.exports, handlers);
_.extend(module.exports, resources);
_.extend(module.exports, diffs);
