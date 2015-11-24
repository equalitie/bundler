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
var logger = require('./logger');

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

/**
 * Register a new handler to a particular event.
 * @param {string} hookname - The name of the event to have trigger the handler
 * @param {function} handler - The handler function to evoke when the event fires
 */
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
  }
  return this;
};

/**
 * Start the bundling process.
 * @param {function(error, string)} callback - Callback called when bundling is complete
 */
Bundler.prototype.bundle = function (callback) {
  this.callback = callback;
  var initOptions = {
      url: this.url,
      strictSSL: false,
      rejectUnauthorized: false
  };
  var thisBundler = this;
  if (typeof this.url === 'undefined') {
    logger.error('No URL provided to bundler.');
    callback(new Error('No URL provided to bundler.'), null);
  } else {
    async.reduce(this.originalRequestHooks, initOptions, function (memo, hook, next) {
      hook(memo, next);
    }, function (err, options) {
      if (err) {
        logger.error(err.message);
        this.callback(err, null);
      } else {
        makeBundle(thisBundler, options);
      }
    });
  }
}

/**
 * Starts bundling with the main document requested and begins invoking handlers.
 * @param {Bundler} bundler - The bundler with handlers registered to invoke
 * @param {object} options - Options for the request call
 */
function makeBundle(bundler, options) {
  request(options, function (err, res, body) {
    if (err) {
      logger.error('------ERROR------ in makeBundle\n' + err.message);
      logger.info('URL: ' + options.url);
      bundler.callback(err, null);
    } else {
      invokeHandlers(bundler, body, wrappedRequest(bundler, res, body));
    }
  });
}

/**
 * Produces a closure wrapping the request function so that bundler properties
 * and the response from the original request can be made available to handlers
 * @param {Bundler} bundler - The bundler that is executing its handlers
 * @param {object} originalResponse - The response from the first request call
 * @param {Buffer} originalBody - The body of the first document requested
 */
function wrappedRequest(bundler, originalResponse, originalBody) {
  return function (opts, callback) {
    if (typeof opts === 'string') {
      opts = { url : opts };
    }
    logger.info('Making request with options: ', opts);
    async.reduce(bundler.resourceRequestHooks, opts, function (memo, hook, next) {
      hook(memo, next, originalBody, originalResponse);
    }, function (err, options) {
      if (err) {
        logger.error(err.message);
        bundler.callback(err, null);
      } else {
        options.encoding = null;
        request(options, function (err, response, body) {
          if (err) {
            logger.error('------ERROR------ in wrappedRequest\n' + err.message);
            logger.info('URL: ' + options.url);
            if (err.message.substring(0, 11) === 'Invalid URI' ||
                err.message.substring(0, 16) === 'Invalid protocol') {
              callback(null, null, new Buffer(''));
            } else {
              bundler.callback(err, null);
            }
          } else {
            var contentType = response.headers['content-type'];
            contentType = contentType ? contentType : response.headers['Content-Type'];
            if (typeof contentType !== 'undefined' && contentType.indexOf('image') >= 0) {
              callback(null, response, body);
            } else {
              body = body.toString();
              logger.verbose('Calling resourceReceivedHooks');
              async.reduce(bundler.resourceReceivedHooks, {}, function (memoDiffs, nextHook, iterFn) {
                nextHook(wrappedRequest(bundler, response, body), options, body, memoDiffs, response, iterFn);
              }, function (error, diffs) {
                if (error) {
                  logger.error(error.message);
                  callback(error, response, body);
                } else {
                  logger.verbose('Applying diffs to document');
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

/**
 * Begins the process of invoking resource handlers in parallel.
 * @param {Bundler} bundler - The bundler whose handlers are being executed
 * @param {string} originalDoc - The body of the original document requested
 * @param {function} requestFn - A wrapper around the request function
 */
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
      logger.error(err.message);
      bundler.callback(err, null);
    } else {
      var allDiffs = _.reduce(diffs, _.extend);
      logger.verbose('Calling', bundler.diffHooks.length, 'diffHooks');
      handleDiffs(bundler, originalDoc, allDiffs);
    }
  });
}

/**
 * Invoke handlers for managing diffs produced.
 * @param {Bundler} bundler - The bundler whose handlers are being executed
 * @param {string} html - The content of the document being bundled
 * @param {object} diffs - The collection of diffs produced by handlers
 */
function handleDiffs(bundler, html, diffs) {
  async.reduce(bundler.diffHooks, diffs, function (memo, hook, next) {
    hook(memo, next);
  }, function (err, newDiffs) {
    logger.debug('Finished calling diff handlers');
    logger.debug('err is', err);
    if (err) {
      logger.error(err.message);
      bundler.callback(err, null);
    } else {
      logger.debug('About to apply diffs');
      html = helpers.applyDiffs(html, newDiffs);
      logger.info('Succeeded in producing bundle');
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
