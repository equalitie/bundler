var bundler = require('../../src/bundler');

var bundling = new bundler.Bundler('https://news.ycombinator.com');

bundling.on('originalReceived', bundler.replaceImages);
bundling.on('originalReceived', bundler.replaceCSSFiles);
bundling.on('originalReceived', bundler.replaceJSFiles);

function makeBundle() {

  bundling.bundle(function (err, bundle) {
    if (!err) {
      console.log('Bundle created.');
    } else {
      console.log('Failed to create bundle.');
    }
  });
}

makeBundle();