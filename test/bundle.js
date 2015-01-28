var should = require('should');
var request = require('request');
var cheerio = require('cheerio');
var bundler = require('../src/bundler');
var log = require('../src/logger');

var testURL = 'https://en.wikipedia.org/wiki/Data_URI_scheme';

describe('bundler', function () {
  it('should call hooks before making the original request', function (done) {
    var called = false;
    (new bundler.makeBundler('https://news.ycombinator.com'))
    .beforeOriginalRequest(bundler.modifyRequests.stripHeaders(['Origin', 'Host']))
    .beforeOriginalRequest(function (options, callback) {
      should.exist(options);
      options.should.have.property('headers');
      options.headers.should.have.property('Origin');
      options.headers['Origin'].should.be.empty;
      options.headers.should.have.property('Host');
      options.headers['Host'].should.be.empty;
      called = true;
      callback(null, options);
    })
    .useHandler(bundler.resources.replaceImages)
    .send(function (err, bundle) {
       should.not.exist(err);
       should.exist(bundle);
       should(called).be.ok;
       done();
    });
  });

  it('should call hooks before making each resource request', function (done) {
    var called = false;
    (new bundler.makeBundler('https://news.ycombinator.com'))
    .beforeFetchingResources(function (options, next, $, response) {
      called = true;
      next(null, options);
    })
    .useHandler(bundler.resources.replaceImages)
    .send(function (err, bundle) {
      should.not.exist(err);
      should.exist(bundle);
      should(called).be.ok;
      done();
    });
  });

  it('should call hooks to inspect and modify diffs', function (done) {
    var called = false;
    (new bundler.makeBundler('https://news.ycombinator.com'))
    .useHandler(bundler.resources.replaceJSFiles)
    .afterFetchingResources(function (diffs, callback) {
      called = true;
      callback(null, diffs);
    })
    .send(function (err, bundle) {
      should.not.exist(err);
      should.exist(bundle);
      should(called).be.ok;
      done();
    });
  });
});
