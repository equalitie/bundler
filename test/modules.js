var fs = require('fs');
var http = require('http');
var urllib = require('url');
var path = require('path');
var should = require('should');
var request = require('request');
var cheerio = require('cheerio');
var bundler = require('../src/bundler');

// Base of path to resources to be served for testing purposes
const RESOURCE_BASE = './test/resources';

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

  describe('cssReferenceFinder', function () {
    it('should call a callback with every instance of url() found', function (done) {
      var test = 'div#test { background:url(/images/srpr/logo11w.png) ' +
                 'no-repeat;background-size:269px 95px;height:95px;width:269px }';
      bundler.cssReferenceFinder(test)(function (url) {
        should.exist(url);
        url.should.be.exactly('/images/srpr/logo11w.png');
        done();
      });
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
          done();
        });
      });
    });
  });

  describe('replaceURLCalls', function () {
    it('should replace url() calls in inline style definitions', function (done) {
      var testURL = 'http://equalit.ie';
      request(testURL, function (err, response, body) {
        bundler.replaceURLCalls(request, body, testURL, function (err, diffs) {
          should.not.exist(err);
          should.exist(diffs);
          Object.keys(diffs).length.should.be.greaterThan(0);
          done();
        });
      });
    });
  });

  describe('predicated', function () {
    it('should only make replacements if a provided predicate passes', function (done) {
      bundler.predicated(function (doc, resourceURL) {
        return true;
      }, function (request, body, url, done) {
        should.exist(request);
        should.exist(body);
        should.exist(url);
        done();
      })('request placeholder', 'body placeholder', 'test url', done);
    });

    it('should not call the provided handler if the predicate fails', function (done) {
      bundler.predicated(function (doc, resourceURL) {
        return false;
      }, function (request, body, url, done) {
        should(1).be.exactly(2); // We should never get here, so fail if we do.  
      })('request placeholder', 'body placeholder', 'test url', done);
      // Wait a second to make sure the handler function provided to predicated is not called.
      setTimeout(function () {}, 1000);
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

describe('resources', function () {
  describe('bundleCSSRecursively', function () {
    before(function () {
      this.server = http.createServer(function (req, res) {
        var requested = urllib.parse(req.url).pathname;
        fs.readFile(path.join(RESOURCE_BASE, requested), function (err, content) {
          if (err) {
            res.statusCode = 404;
            res.end();
          } else {
             res.statusCode = 200;
             res.write(content);
             res.end();
          }
        });
      });
      this.server.listen(9009);
    });

    it('should not get stuck in an infinite loop because of mutually recursive imports', function (done) {
      var b = new bundler.Bundler('http://localhost:9009/index.html');
      b.on('originalReceived', bundler.replaceCSSFiles);
      b.on('resourceReceived', bundler.bundleCSSRecursively);
      b.bundle(function (err, bundle) {
        should.not.exist(err);
        should.exist(bundle);
        bundle.should.have.property('length');
        bundle.length.should.be.greaterThan(0);
        done();
      });
    });

    after(function () {
      this.server.close();
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
