# bundler

A utility for bundling resources in web pages into a single page by inlining them
using the [data URI scheme](https://en.wikipedia.org/wiki/Data_URI_scheme).

It is designed to be easy to use in all kinds of scenarios, ranging from ones
where one simply wants to produce a web page with certain resources bundled to
scenarios where one would like to proxy resource requests, include caching
functionality, modify request headers, and more.

# Basic Usage

The simplest use case for the bundler is the case where one would like to:

1. Fetch a web page, given a URL
2. Replace references to certain kinds of resources with their data URIs

This can be accomplished very simply.  In the following example, we can
fetch [Hacker News](https://news.ycombinator.com)'s main page and bundle the
images on the site into the HTML.

```javascript
var bundleMaker = new bundler.Bundler('https://news.ycombinator.com');

bundleMaker.on('originalReceived', bundler.replaceImages);

bundleMaker.bundle(function (err, bundle) {
  console.log(bundle);
});
```

Currently, there are three resource handlers exported in the bundler module:

1. replaceImages
2. replaceCSSFiles
3. replaceJSFiles

which all do exactly what you would expect.

More on writing your own resource handlers in the *Writing Your Own Hooks*
section below.

# Terminology

A `diff` is an object whose key is a resource URL and whose value is a data URI.

A `handler` is a function that analyzes a web page to produce diffs.

A `hook` is a function that can manipulate request option data or diffs.

# Using Hooks

![Architectural diagram](https://raw.githubusercontent.com/equalitie/bundler/master/architecture.png)

Bundler provides four opportunities to inject new functionality into the
bundling process.

1. `originalRequest`  - Before fetching the first, original document
2. `originalReceived` - Specify handlers used to scan the document and produce diffs 
3. `resourceRequest`  - Before fetching any resource referenced by the original document
4. `diffsReceived`    - After accumulating a collection of resource URLs and their data URIs

As seen above, you can register handlers using the `originalReceived` event.

## Before fetching the original document

Because one may wish to modify request headers, among other things, bundler
allows for hooks to be called before making a request for the original document.
For example, to replace the `Referer` header with `https://duckduckgo.com`:

```javascript
var bundleMaker = new bundler.Bundler('https://yahoo.com');

bundleMaker.on('originalRequest', bundler.spoofHeaders({
  'Referer': 'https://duckduckgo.com'
}));

bundleMaker.on('originalReceived', bundler.replaceImages);
bundleMaker.on('originalReceived', bundler.replaceCSSFiles);

bundleMaker.bundle(function (err, bundle) {
  console.log(bundle);
});
```

Currently, three request modifiers are exported.

### stripHeaders

`stripHeaders` accepts an array of header names to replace with blank values in the
request object and returns the hook function that `Bundler.on` expects.

### spoofHeaders

`spoofHeaders` accepts an object mapping header names to the value to insert in
their place and returns the hook function that `Bundler.on` expects.

### proxyTo

`proxyTo` accepts a URL that requests will be configured to use as a proxy.
See [request's documentation on proxies](https://github.com/request/request#proxies)
to understand how that works.  The function accepts the URL and returns the handler
function that `Bundler.on` expects.

### followRedirects

`followRedirects` confgures the redirect-handling options for the `request` object. It accepts:

1. `first`: bool - Whether or not to follow the first redirect resulting from a request.
2. `all`: bool - Whether or not to follow all redirects that might result from requests.
3. `limit`: int - The maximum number of redirects to follow.

See [request's option documentation](https://github.com/request/request#requestoptions-callback)
to learn more about what request defaults to.

## Handling resources

Resource handlers are used to extract references to resources in a document, such as those in script tags, link tags, and so on.
They are responsible for producing diff objects that bundler will go on to
use to replace references to such resources with data-URIs.

As mentioned in the *Basic Usage* section, resource handlers are registered
using the `originalReceived` event. Bundler currently exports the following handlers.

1. replaceImages
2. replaceCSSFiles
3. replaceJSFiles

## Before fetching each resource

Bundler allows request options to be set for each resource that is to be retrieved.
The functions from `bundler.modifyRequests` can be reused here.  For example:

```javascript
var bundleMaker = new bundler.Bundler('https://yahoo.com');

bundleMaker.on('resourceRequest', bundler.spoofHeaders({
  'Referer': 'https://duckduckgo.com'
}));

bundleMaker.on('originalReceived', bundler.replaceImages);
bundleMaker.on('originalReceived', bundler.replaceCSSFiles);

bundleMaker.bundle(function (err, bundle) {
  console.log(bundle);
});
```

Note that the only difference between this example and the one in the first section
is that this one registers hooks for the `resourceRequest` method. You can reuse
handlers written for `originalRequest` here.

**Currently no special handlers are implemented here**

## After building data URIs

In case one would like to prevent bundler from making certain kinds of replacements,
for example if a data URI is too long or the resource is hosted on a particular site,
one can register hooks to be run when the collection of diffs has been compiled.

Currently, `bundler.filterDiffs` is the only existing hook exported
for this purpose. An example of filtering out resources that appear to be hosted
on `google.com`:

```javascript
var bundleMaker = new bundler.Bundler(url);

bundleMaker.on('originalReceived', bundler.replaceImages);
bundleMaker.on('originalReceived', bundler.replaceCSSFiles);

bundleMaker.on('diffsReceived', bundler.filterDiffs(function (src, dest) {
  return src.indexOf('google.com') < 0;
}));

bundleMaker.bundle(function (err, bundle) {
  console.log(bundle);
});
```

# Writing your own hooks

It is, of course, possible to write your own hooks to use in any of the cases outlined
above. Each type of hook has a different signature but are expected to behave in
approximately the same ways.

## Before fetching the original document

Hooks to be added to the Bundler object using the `originalRequest` event 
should have the following form:

```javascript
function handlerName(options, callback) {
  // Do something with options
  callback(err, options);
}
```

The `callback` provided is used to iterate through hooks, and so must be called
with any error that might occur (or `null` otherwise) and the modified `options`
object.

The `options` object is the object passed to the [request](https://github.com/request/request)
library as the first argument to `request` as seen in the library's
[Custom HTTP Headers](https://github.com/request/request#custom-http-headers)
documentation.

For example, we could register the following hook to increment a global count of the total
number of bundle requests the server has received.

```javascript
var bundlerCalls = 0;

var bundleMaker = new bundler.Bundler(url);

bundleMaker.on('originalReceived', bundler.replaceImages);

bundleMaker.on('originalRequest', function (options, callback) {
  bundlerCalls++;
  callback(null, options);
});

bundleMaker.bundle(function (err, bundle) {
  console.log(bundle);
});
```

## Handling resources

Handlers for replacing resources in a document, like `bundler.replaceImages` can also be supplied to the bundler.  Such functions have the following form.

```javascript
function handlerName(request, $, url, callback) {
  var element = $('some-selector');
  request({url: element.attr('some-attr')}, function (err, response, body) {
    // produce a diff object
    var diff = { 'source-url': 'replacement' };
    callback(errorIfAny, diff);
  });
}
```

The `request` parameter is a wrapper around the [request](https://github.com/request) function that will invoke all hooks inserted via `resourceRequest`
to modify the `options` object before making the request. It accepts an  
`options` parameter (or resource URL) and a callback to handle the response.

The `$` parameter is the [Cheerio](https://github.com/cheeriojs/cheerio) object
containing the document fetched by the original request.

The `url` parameter is the URL originally requested, used to produce resolved
paths to discovered resources.

The `callback` parameter is used to iterate through a call to `async.reduce` and must be invoked with any error that occurs (or null) and the diff object
created.

Such handlers tend to become quite complicated quickly as multiple requests will need to be made for resources.  In the bundler library, `async.reduce` is
used to build the diff object.

## Before fetching each resource

Hooks to be added to the Bundler object using the `resourceRequest` event 
should have the following form:

```javascript
function handlerName(options, callback, $, response) {
  // Do something with options
  callback(err, options);
}
```

You will notice that this form is very similar to that of the handler described above.
This is intentional.  The signature for these handlers is a little unusual looking
(having the `callback` before `$` and `response` arguments), however this is done so
that the same handlers written for `originalRequest` can be reused here.

The `options` and `callback` arguments here are the same as they are for the
`originalRequest` handlers.

The `$` argument here is a [Cheerio](https://github.com/cheeriojs/cheerio#cheerio--)
object loaded with the contents of the original document. It can be used in any way
the library allows.

The `response` argument is the response object provided by the call to `request` 
for the original document, which is an instance of
[http.IncomingMessage](http://nodejs.org/api/http.html#http_http_incomingmessage).
This may be useful for obtaining response headers or the status code.

For example, you could set the Referer header of the resource request to the
value of the Host header in the response.

```javascript
var bundleMaker = new bundler.Bundler(url);

bundleMaker.on('originalReceived', bundler.replaceImages);

bundleMaker.on('resourceRequest', function (options, callback, $, response) {
  if (!options.hasOwnProperty('headers')) {
    options.headers = {};
  }
  options.headers['Referer'] = response.headers['host'];
  callback(null, options);
});

bundleMaker.bundle(function (err, bundle) {
  console.log(bundle);
});
```

## After building data URIs

Hooks to be added to the Bundler object using the `diffsReceived` event 
should have the following form.

```javascript
function handlerName(diffs, callback) {
  // Do something with diffs
  callback(err, diffs);
}
```

One could write a handler to count the number of images, CSS files, and JS files
having replacements made with the following hook.

```javascript
var cssReplaces = 0;
var jsReplaces = 0;
var imgReplaces = 0;

var bundleMaker = new bundler.Bundler(url);

bundleMaker.on('originalReceived', bundler.replaceImages);
bundleMaker.on('originalReceived', bundler.replaceCSSFiles);
bundleMaker.on('originalReceived', bundler.replaceJSFiles);

bundleMaker.on('diffsReceived', function (diffs, callback) {
  var sources = Object.keys(diffs);
  for (var i = 0, len = sources.length; i < len; ++i) {
    switch (bundler.mimetype(sources[i])) {
    case 'text/css':
      cssReplaces++;
      break;
    case 'application/javascript':
      jsReplaces++;
      break;
    default:
      imgReplaces++;
    }
  }
  callback(null, diffs);
});

bundleMaker.bundle(function (err, bundle) {
  console.log(cssReplaces + '\t CSS files replaced.');
  console.log(jsReplaces + '\t JS files replaced.');
  console.log(imgReplaces + '\t Image files replaced.');
});
```

# Helper functions

To make writing handlers and hooks a little bit easier, Bundler exports the
following functions.

## bundler.mimetype

```javascript
bundler.mimetype('/stylesheets/hello.css?hello=world');
// -> 'text/css'

bundler.mimetype('image.png');
// -> 'image/png'
```

## bundler.dataURI

```javascript
bundler.dataURI('test.css', new Buffer('h1 {  color: red; }'));
// -> 'data:text/css;base64,aDEgeyAgY29sb3I6IHJlZDsgfQ=='

bundler.dataURI('https://site.com/awesome/code.js', new Buffer('alert("Hello world");'));
// -> 'data:application/javascript;base64,YWxlcnQoIkhlbGxvIHdvcmxkIik7'
```

# Testing

To run the module test script, simply run the command

    npm test

from the project root folder.
