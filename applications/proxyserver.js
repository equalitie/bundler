/* This module creates an HTTP server that can be used as a local proxy
 * to bundle requests for pages that are requested in the browser.
 */
var http = require('http');
var fs = require('fs');
var urllib = require('url');
var qs = require('querystring');
var _ = require('lodash');
var bundler = require('../src/bundler');

var listenAddress = "127.0.0.1";
var portNumber = 9008;

var configFile = './psconfig.json';

var remaps = {};

var config = {
  // Proxy requests for documents and resources to another server
  "useProxy": false,
  "proxyAddress": "",
  "followFirstRedirect": true,
  "followAllRedirects": false,
  "redirectLimit": 10,
  // Headers to clone from the original request sent by the user.
  // See http://nodejs.org/api/http.html#http_message_headers
  "cloneHeaders": [
  ],
  // A mapping of headers to values to write for them in requests.
  "spoofHeaders": {
  },
  "remapsFile": "./remaps.json"
};

_.extend(config, JSON.parse(fs.readFileSync(configFile)));
_.extend(remaps, JSON.parse(fs.readFileSync(config.remapsFile)));

// Log to syslog when not running in verbose mode
/* if (process.argv[2] != '-v') {
 *	Syslog.init("bundler", Syslog.LOG_PID | Syslog.LOG_ODELAY, Syslog.LOG_LOCAL0);
 * }
 */

function extractHeaders(req, headers) {
	var newHeaders = {};
	for (var i = 0, len = headers.length; i < len; ++i) {
		newHeaders[headers[i]] = req.headers[headers[i]];
	}
	return newHeaders;
}

function reverseProxy(remapper) {
  return function (options, next) {
	var url = urllib.parse(options.url);
	var hostname = url.hostname;
	var resource = url.path;
	if (!options.hasOwnProperty('headers')) {
	  options.headers = {};
	}
	if (remapper.hasOwnProperty(hostname)) {
	  options.url = urllib.resolve(remapper[hostname], resource);
	  options.headers['Host'] = hostname;
	}
	next(null, options);
  };
}

function handleRequests(req, res) {
  var url = qs.parse(urllib.parse(req.url).query).url;
	var bundleMaker = new bundler.Bundler(url);
	bundleMaker.on('originalReceived', bundler.replaceImages);
	bundleMaker.on('originalReceived', bundler.replaceJSFiles);
	bundleMaker.on('originalReceived', bundler.replaceCSSFiles);
  bundleMaker.on('originalReceived', bundler.replaceURLCalls);

	if (config.useProxy) {
		bundleMaker.on('originalRequest', bundler.proxyTo(config.proxyAddress));
		bundleMaker.on('resourceRequest', bundler.proxyTo(config.proxyAddress));
	}

	// Clone some headers from the incoming request to go into the original request.
	bundleMaker.on('originalRequest', bundler.spoofHeaders(extractHeaders(req, config.cloneHeaders)));

	// Spoof certain headers on every request.
	bundleMaker.on('originalRequest', bundler.spoofHeaders(config.spoofHeaders));
	bundleMaker.on('resourceRequest', bundler.spoofHeaders(config.spoofHeaders));

	bundleMaker.on('originalRequest', bundler.followRedirects(
		config.followFirstRedirect, config.followAllRedirects, config.redirectLimit));

  bundleMaker.on('resourceRequest', reverseProxy(remaps));

  bundleMaker.on('resourceReceived', bundler.bundleCSSRecursively);

	bundleMaker.bundle(function (err, bundle) {
		if (err) {
			console.log('Failed to create bundle for ' + req.url);
			console.log('Error: ' + err.message);
      res.end();
		} else {
			res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
			res.write(bundle);
			res.end();
		}
	});
}

http.createServer(handleRequests).listen(portNumber, listenAddress, function() {
	//Drop privileges if running as root
	if (process.getuid() === 0) {
	console.log("Dropping privileges");
		process.setgid(config.drop_group);
		process.setuid(config.drop_user);
	}
});
console.log('Proxy server listening on ' + listenAddress + ":" + portNumber);
