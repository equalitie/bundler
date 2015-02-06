var should = require('should');
var request = require('request');
var cheerio = require('cheerio');
var bundler = require('../src/bundler');
var log = require('../src/logger');

var testURL = 'https://en.wikipedia.org/wiki/Data_URI_scheme';

describe('bundler', function () {
  it('should call hooks before making the original request', function (done) {
    var called = false;
    var bundleMaker = new bundler.Bundler('https://news.ycombinator.com');

    bundleMaker.on('originalRequest', bundler.stripHeaders(['Origin', 'Host']));
    
    bundleMaker.on('originalRequest', function (options, callback) {
      should.exist(options);
      options.should.have.property('headers');
      options.headers.should.have.property('Origin');
      options.headers['Origin'].should.be.empty;
      options.headers.should.have.property('Host');
      options.headers['Host'].should.be.empty;
      called = true;
      callback(null, options);
    });

    bundleMaker.on('originalReceived', bundler.replaceImages);

    bundleMaker.bundle(function (err, bundle) {
      should.not.exist(err);
      should.exist(bundle);
      should(called).be.ok;
      done();
    });
  });

  it('should call hooks before making each resource request', function (done) {
    var called = false;
    var bundleMaker = new bundler.Bundler('https://news.ycombinator.com');

    bundleMaker.on('resourceRequest', function (options, next, body, response) {
      called = true;
      options.should.have.property('url');
      should.exist(next);
      should.exist(body);
      should.exist(response);
      next(null, options);
    });

    bundleMaker.on('originalReceived', bundler.replaceImages);

    bundleMaker.bundle(function (err, bundle) {
      should.not.exist(err);
      should.exist(bundle);
      should(called).be.ok;
      done();
    });
  });

  it('should call hooks after fetching each resource', function (done) {
    var called = false;
    var bundleMaker = new bundler.Bundler('https://news.ycombinator.com');

    bundleMaker.on('resourceReceived', function (requestFn, body, response, next) {
      called = true;
      should.exist(requestFn);
      should.exist(body);
      should.exist(response);
      next(null, body);
    });

    bundleMaker.on('originalReceived', bundler.replaceImages);

    bundleMaker.bundle(function (err, bundle) {
      should.not.exist(err);
      called.should.be.true;
      should.exist(bundle);
      done();
    });
  });

  it('should call hooks to inspect and modify diffs', function (done) {
    var called = false;
    var bundleMaker = new bundler.Bundler('https://news.ycombinator.com');

    bundleMaker.on('originalReceived', bundler.replaceJSFiles);

    bundleMaker.on('diffsReceived', function (diffs, callback) {
      called = true;
      callback(null, diffs);
    });

    bundleMaker.bundle(function (err, bundle) {
      should.not.exist(err);
      should.exist(bundle);
      should(called).be.ok;
      done();
    });
  });
});
