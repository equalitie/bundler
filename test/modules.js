var should = require('should');
var request = require('request');
var cheerio = require('cheerio');
var bundler = require('../src/bundler');

describe('helpers', function () {
  describe('mimetype', function () {
    it('should determine HTML to be text/html', function () {
      var mt = bundler.mimetype('https://sometest.com/index.html');
      should.exist(mt);
      mt.should.be.exactly('text/html');
    });
    
    it('should determine a PNG image to be image/png', function () {
      var mt = bundler.mimetype('https://sometest.com/images/test.png');
      should.exist(mt);
      mt.should.be.exactly('image/png');
    });
  
    it('should default to text/plain for unknown document types', function () {
      var mt = bundler.mimetype('can you explain this?');
      should.exist(mt);
      mt.should.be.exactly('text/plain');
    });
  });

  describe('dataURI', function () {
    it('should produce a data URI scheme for provided data', function () {
      var duri = bundler.dataURI({headers: {}}, 'image.png', new Buffer('hello'));
      should.exist(duri);
      duri.should.be.exactly('data:image/png;base64,aGVsbG8=');
    });
  });
});

describe('requests', function () {
  describe('stripHeaders', function () {
    it('should remove specified headers from request options', function (done) {
      var options = { url: 'test.com', headers: {
        'Origin': 'testing.com',
        'Host': 'bundler.ca',
        'Referer': 'the internet'
      }};
      bundler.stripHeaders(['Origin', 'Host'])(options, function (err, opts) {
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

  describe('spoofHeaders', function () {
    it('should replace specific values with given values', function (done) {
      var replacements = { 'Referer': 'https://duckduckgo.com' };
      var options = request.defaults();
      bundler.spoofHeaders(replacements)(options, function (err, opts) {
        should.not.exist(err);
        should.exist(opts);
        opts.should.have.property('headers');
        opts.headers.should.have.property('Referer');
        opts.headers['Referer'].should.be.exactly('https://duckduckgo.com');
        done();
      });
    });
  });
});

describe('handlers', function () {
  describe('replaceImages', function () {
    it('should substitute all images with data-URIs', function (done) {
      var url = 'https://news.ycombinator.com';
      var options = { url: url };
      request(url, function (err, response, body) {
        bundler.replaceImages(request, body, url, function (err, diff) {
          should.not.exist(err);
          should.exist(diff);
          Object.keys(diff).length.should.be.greaterThan(0);
          done();
        });
      });
    });
  });
  
  describe('replaceCSSFiles', function () {
    it('should substitute all CSS files with data-URIs', function (done) {
      var url = 'https://news.ycombinator.com';
      var options = { url: url };
      request(url, function (err, response, body) {
        bundler.replaceCSSFiles(request, body, url, function (err, diff) {
          should.not.exist(err);
          should.exist(diff);
          Object.keys(diff).length.should.be.greaterThan(0);
          done();
        });
      });
    });
  });
  
  describe('replaceJSFiles', function () {
    it('should substitute all JS files with data-URIs', function (done) {
      var url = 'https://reddit.com';
      var options = { url: url };
      request(url, function (err, response, body) {
        bundler.replaceJSFiles(request, body, url, function (err, diff) {
          should.not.exist(err);
          should.exist(diff);
          Object.keys(diff).length.should.be.greaterThan(0);
          done();
        });
      });
    });
  });

  describe('replaceLinks', function () {
    it('should call a provided function to replace certain links', function (done) {
      var originalURL = 'https://news.ycombinator.com';
      request(originalURL, function (err, response, body) {
        var linkCount = 0;
        function replaceAllLinks(url, resource) {
          linkCount++;
          return '' + linkCount;
        }
        bundler.replaceLinks(replaceAllLinks)(request, body, originalURL, function (err, diffs) {
          should.not.exist(err);
          should.exist(diffs);
          var keys = Object.keys(diffs);
          should.exist(keys);
          keys.should.have.property('length');
          diffs[keys[0]].should.be.exactly('1');
          diffs[keys[keys.length - 1]].should.be.exactly('' + linkCount);
          done();
        });
      });
    });
  });
});

describe('requests', function() {
  describe('proxyRequests', function () {
    it('should not do anything for now', function (done) {
      done();
    });
  });
  
  describe('handleRedirect', function () {
    it('should not do anything for now', function (done) {
      done();
    });
  });
});

describe('diffs', function () {
  describe('filterDiffs', function () {
    it('should remove diffs satisfying some criteria', function (done) {
      var diff = { 'https://google.com': 'test data', '/image.png': 'test data 2' };
      bundler.filterDiffs(function (source, dest) {
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
});
