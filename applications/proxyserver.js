/* This module creates an HTTP server that can be used as a local proxy
 * to bundle requests for pages that are requested in the browser.
 */
var http = require('http');
var fs = require('fs');
var urllib = require('url');
var qs = require('querystring');
var nodeConstants = require('constants');
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

// Allow self-signed certs of all shapes and sizes.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"

function extractHeaders(req, headers) {
	var newHeaders = {};
	for (var i = 0, len = headers.length; i < len; ++i) {
		if (req.headers.hasOwnProperty(headers[i])) {
			newHeaders[headers[i]] = req.headers[headers[i]];
		}
	}
	return newHeaders;
}

function reverseProxy(remapper) {
  return function (options, next) {
  	var url = urllib.parse(options.url);
  	var hostname = url.hostname;
  	var resource = url.path;
  	var protocol = url.protocol;
  	if (!options.hasOwnProperty('headers')) {
  	  options.headers = {};
  	}
  	if (remapper.hasOwnProperty(hostname)) {
  	  options.url = urllib.resolve(protocol + "//" + remapper[hostname], resource);
  	  options.headers['Host'] = hostname;
      if (!options.hasOwnProperty('agentOptions')) {
        options.agentOptions = {};
      }
      options.agentOptions.secureOptions = nodeConstants.SSL_OP_NO_TLSv1_2;
  	}
    console.log('###### OPTIONS = ', options);
  	next(null, options);
  };
}

function renderErrorPage(req, res, error) {
  var url = qs.parse(urllib.parse(req.url).query).url;
  fs.readFile('./error.html', function (err, content) {
    if (err) {
      console.log('Could not read error.html; Error: ' + err.message);
      res.writeHead(500, {'Content-Type': 'text/plain'});
      res.write('An error occurred while trying to create a bundle for you.\n');
      res.write('Requested url: ' + url + '\n');
      res.write('The error provided says: ' + error.message + '\n');
      res.end();
    } else {
      if (!res.finished) {
          content = content.toString();
          res.writeHead(500, {'Content-Type': 'text/html'});
          content = content.replace('{{url}}', url);
          content = content.replace('{{error}}', error.message);
          content = content.replace('{{stack}}', error.stack);
          res.write(content);
          res.end();
      }
    }
  });
}

function handleRequests(req, res) {
  var url = qs.parse(urllib.parse(req.url).query).url;
  var ping = qs.parse(urllib.parse(req.url).query).ping;
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

  bundleMaker.on('resourceReceived', bundler.bundleCSSRecursively);

  bundleMaker.on('originalRequest', reverseProxy(remaps));
  bundleMaker.on('resourceRequest', reverseProxy(remaps));

    if (ping) {
        res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
        res.write("OK");
        res.end();
    } else {

	bundleMaker.bundle(function (err, bundle) {
	    if (err) {
		console.log('Failed to create bundle for ' + req.url);
		console.log('Error: ' + err.message);
                renderErrorPage(req, res, err);
	    } else {
		res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
		res.write(bundle);
		res.end();
	    }
	});
    }
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
