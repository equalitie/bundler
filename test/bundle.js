var should = require('should');
var bundler = require('../src/bundler');

var testURL = 'https://en.wikipedia.org/wiki/Data_URI_scheme';

describe('bundler', function () {
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
      var duri = bundler.dataURI('image.png', new Buffer('hello'));
      should.exist(duri);
      duri.should.be.exactly('data:image/png;base64,aGVsbG8=');
    });
  });

  describe('makeBundle', function () {
    it('should bundle a page like a wikipedia article', function (done) {
      var handlers = [bundler.replaceImages, bundler.replaceCSSFiles, bundler.replaceJSFiles];
      bundler.makeBundle(testURL, handlers, function (err, bundle) {
        should.not.exist(err);
        should.exist(bundle);
        done();
      });
    });
  });
});
