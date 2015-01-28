var should = require('should');
var request = require('request');
var cheerio = require('cheerio');
var bundler = require('../src/bundler');
var log = require('../src/logger');

var testURL = 'https://en.wikipedia.org/wiki/Data_URI_scheme';

describe('bundler', function () {
  describe('helpers.mimetype', function () {
    it('should determine HTML to be text/html', function () {
      var mt = bundler.helpers.mimetype('https://sometest.com/index.html');
      should.exist(mt);
      mt.should.be.exactly('text/html');
    });
    it('should determine a PNG image to be image/png', function () {
      var mt = bundler.helpers.mimetype('https://sometest.com/images/test.png');
      should.exist(mt);
      mt.should.be.exactly('image/png');
    });
    it('should default to text/plain for unknown document types', function () {
      var mt = bundler.helpers.mimetype('can you explain this?');
      should.exist(mt);
      mt.should.be.exactly('text/plain');
    });
  });

  describe('helpers.dataURI', function () {
    it('should produce a data URI scheme for provided data', function () {
      var duri = bundler.helpers.dataURI('image.png', new Buffer('hello'));
      should.exist(duri);
      duri.should.be.exactly('data:image/png;base64,aGVsbG8=');
    });
  });

  describe('modifyRequest.stripHeaders', function () {
    it('should remove specified headers from request options', function (done) {
      var options = { url: 'test.com', headers: {
        'Origin': 'testing.com',
        'Host': 'bundler.ca',
        'Referer': 'the internet'
      }};
      bundler.modifyRequests.stripHeaders(['Origin', 'Host'])(options, function (err, opts) {
        should.not.exist(err);
        opts.should.have.property('url');
        opts.url.should.be.exactly('test.com');
        opts.should.have.property('headers');
        opts.headers.should.have.property('Origin');
        opts.headers['Origin'].should.be.empty;
        opts.headers.should.have.property('Host');
        opts.headers['Host'].should.be.empty;
        opts.headers.should.have.property('Referer');
        opts.headers['Referer'].should.be.exactly('the internet');
        done();
      });
    });
  });

  describe('modifyRequest.spoofHeaders', function () {
    it('should replace specific values with given values', function (done) {
      var replacements = { 'Referer': 'https://duckduckgo.com' };
      var options = request.defaults();
      bundler.modifyRequests.spoofHeaders(replacements)(options, function (err, opts) {
        should.not.exist(err);
        should.exist(opts);
        opts.should.have.property('headers');
        opts.headers.should.have.property('Referer');
        opts.headers['Referer'].should.be.exactly('https://duckduckgo.com');
        done();
      });
    });
  });

  describe('resources.replaceImages', function () {
    it('should substitute all images with data-URIs', function (done) {
      var url = 'https://news.ycombinator.com';
      var options = { url: url };
      request(url, function (err, response, body) {
        var $ = cheerio.load(body);
        bundler.resources.replaceImages($, url, options, function (err, diff) {
          should.not.exist(err);
          should.exist(diff);
          diff.should.have.property('y18.gif');
          diff.should.have.property('s.gif');
          done();
        });
      });
    });
  });

  describe('resources.replaceCSSFiles', function () {
    it('should substitute all CSS files with data-URIs', function (done) {
      var url = 'https://news.ycombinator.com';
      var options = { url: url };
      request(url, function (err, response, body) {
        var $ = cheerio.load(body);
        bundler.resources.replaceCSSFiles($, url, options, function (err, diff) {
          should.not.exist(err);
          should.exist(diff);
          diff.should.have.property('news.css?zNb0mCdSh7C7CxzWOGA8');
          done();
        });
      });
    });
  });

  describe('resources.replaceJSFiles', function () {
    it('should substitute all JS files with data-URIs', function (done) {
      var url = 'https://reddit.com';
      var options = { url: url };
      request(url, function (err, response, body) {
        var $ = cheerio.load(body);
        bundler.resources.replaceJSFiles($, url, options, function (err, diff) {
          should.not.exist(err);
          should.exist(diff);
          diff.should.have.property('//www.redditstatic.com/reddit.en.jxWbGzb4N-o.js');
          done();
        });
      });
    });
  });
  
  describe('changeRequestBehavior.proxyRequests', function () {
    it('should not do anything for now', function (done) {
      done();
    });
  });

  describe('changeRequestBehavior.handleRedirect', function () {
    it('should not do anything for now', function (done) {
      done();
    });
  });

  describe('modifyReplacements.filterReplacements', function () {
    it('should remove diffs satisfying some criteria', function (done) {
      var diff = { 'https://google.com': 'test data', '/image.png': 'test data 2' };
      bundler.modifyReplacements.filterReplacements(function (source, dest) {
        return source.indexOf('google') < 0;
      })(diff, function (err, newDiff) {
        should.not.exist(err);
        should.exist(newDiff);
        newDiff.should.not.have.property('https://google.com');
        newDiff.should.have.property('/image.png');
        newDiff['/image.png'].should.be.exactly('test data 2');
        done();
      });
    });
  });

  // Test out the bundler itself

  it('should call hooks before making the original request', function (done) {
    var called = false;
    (new bundler.Bundler('https://news.ycombinator.com'))
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
    (new bundler.Bundler('https://news.ycombinator.com'))
    .beforeFetchingResources(function (options, next, $, response) {
      options.should.have.property('url');
      called = true;
      next(null, option);
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
    (new bundler.Bundler('https://news.ycombinator.com'))
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

  it('should use only specified handlers', function (done) {
    var calledHandler = false;
    var calledDiffHandler = false;
    (new bundler.Bundler('https://news.ycombinator.com'))
    .useHandler(bundler.resources.replaceCSSFiles)
    .useHandler(function ($, url, options, callback) {
      calledHandler = true;
      callback(null, {});
    })
    .afterFetchingResources(function (diffs, callback) {
      calledDiffHandler = true;
      should.exist(diffs);
      diffs.should.have.property('news.css?zNb0mCdSh7C7CxzWOGA8');
      diffs.should.not.have.property('y18.gif');
    })
    .send(function (err, bundle) {
      should.not.exist(err);
      should.exist(bundle);
      should(calledHandler).be.ok;
      should(calledDiffHandler).be.ok;
      done();
    });
  });
});
