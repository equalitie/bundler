var bundler = require('./src/bundler');

var bundleMaker = new bundler.Bundler('https://news.ycombinator.com');

// Before making the request to ycombinator.com
bundleMaker.on('originalRequest', function (options, callback) {
  options.headers = {'Referer': 'nobody.lol'};
  console.log(options);
  callback(null, options);
});

// To handle resources
bundleMaker.on('originalReceived', bundler.replaceImages);
bundleMaker.on('originalReceived', bundler.replaceCSSFiles);

// Before requesting resources
bundleMaker.on('resourceRequest', function (options, callback, $, response) {
  console.log(options);
  callback(null, options);
});

bundleMaker.on('resourceRequest', function (options, callback, $, response) {
  options.headers = { 'Referer': response.headers.host };
  callback(null, options);
});

// After diffs are compiled
bundleMaker.on('diffsReceived', function (diffs, callback) {
  console.log(Object.keys(diffs).length + ' diffs compiled.');
  callback(null, diffs);
});

// Start the bundling process
bundleMaker.bundle(function (err, bundle) { 
  console.log(bundle);
});
