/* This module creates an HTTP server that can be used as a local proxy
 * to bundle requests for pages that are requested in the browser.
 */
var http = require('http');
var urllib = require('url');
var bundler = require('../src/bundler');

var portNumber = 9008;

function handleRequests(req, res) {
	var bundleMaker = new bundler.Bundler(req.url);
	bundleMaker.on('originalReceived', bundler.replaceImages);
	bundleMaker.on('originalReceived', bundler.replaceJSFiles);
	bundleMaker.on('originalReceived', bundler.replaceCSSFiles);
	bundleMaker.bundle(function (err, bundle) {
		if (err) {
			console.log('Failed to create bundle for ' + req.url);
			console.log('Error: ' + err.message);
		} else {
			res.writeHead(200, {'Content-Type': 'text/html'});
			res.write(bundle);
			res.end();
		}
	});
}

http.createServer(handleRequests).listen(portNumber);
console.log('Proxy server listening on port ' + portNumber);