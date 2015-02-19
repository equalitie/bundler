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

Currently, there are five resource handlers exported in the bundler module:

1. replaceImages
2. replaceCSSFiles
3. replaceJSFiles
4. replaceLinks
5. replaceURLCalls

The first three are pretty straightforward. You register all of them the same way (like in the example of `repaceImages` above).

`replaceLinks` accepts a function that will be called to generate new links.  The signature of this function is

```javascript
function linkReplacer(baseURL, resourceURL) {
  return combine(baseURL, resourceURL);
}
```

Here, you are free to define how you combine the baseURL and resourceURL as long as you return the value at the end.

For example, you might register a link replacer to transform all urls to the form "http://localhost:9001?url=URL".

`replaceURLCalls` does not accept any parameters.  It will search through the inline `style` attributes of tags and bundle the resources referenced in the CSS `url()` function.

More on writing your own resource handlers in the *Writing Your Own Hooks*
section below.

# Terminology

A `diff` is an object whose key is a resource URL and whose value is a data URI.

A `handler` is a function that analyzes a web page to produce diffs.

A `hook` is a function that can manipulate request option data or diffs.

# Using Hooks

![Architectural diagram](https://raw.githubusercontent.com/equalitie/bundler/master/architecture.png)

Bundler provides five opportunities to inject new functionality into the
bundling process.

1. `originalRequest`  - Before fetching the first, original document
2. `originalReceived` - Specify handlers used to scan the document and produce diffs 
3. `resourceRequest`  - Before fetching each resource referenced by the original document
4. `resourceReceived` - After retrieving each resource referenced by the original document
5. `diffsReceived`    - After accumulating a collection of resource URLs and their data URIs

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
4. replaceLinks
5. replaceURLCalls

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

## After retrieving each resource

Bundler allows hooks to be registered to directly manipulate the body of a fetched resource through the `resourceReceived` event.  Currently no 
handlers are exported directly by bundler for these events.

Currently there is one function exported by bundler to operate on retrieved resources. This is the `bundleCSSRecursively` function, which takes no arguments to use.  It will find instances of calls to `url()` in CSS documents
and replace the URL within with a data URI.

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
function handlerName(request, originalDoc, url, callback) {
  var resourceURL = findResourceURL(originalDoc);
  request({url: resourceURL}, function (err, response, body) {
    // produce a diff object
    var diff = { 'source-url': 'replacement' };
    callback(errorIfAny, diff);
  });
}
```

The `request` parameter is a wrapper around the [request](https://github.com/request) function that will invoke all hooks inserted via `resourceRequest`
and `resourceRetrieved`
to modify the `options` object and to produce diffs for the resource before and after making the request. It accepts an  
`options` parameter (or resource URL) and a callback to handle the response.

The `originalDoc` parameter contains the document fetched by the original request.

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
function handlerName(options, callback, originalDocument, response) {
  // Do something with options
  callback(err, options);
}
```

You can reuse hooks for the `originalRequest` event here.

The `options` and `callback` arguments here are the same as they are for the
`originalRequest` handlers.

The `originalDocument` argument here contains the content of the originally
fetched document.

The `response` argument is the response object provided by the call to `request` 
for the original document, which is an instance of
[http.IncomingMessage](http://nodejs.org/api/http.html#http_http_incomingmessage).
This may be useful for obtaining response headers and the status code.

For example, you could set the Referer header of the resource request to the
value of the Host header in the response.

```javascript
var bundleMaker = new bundler.Bundler(url);

bundleMaker.on('originalReceived', bundler.replaceImages);

bundleMaker.on('resourceRequest', function (options, callback, doc, response) {
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

## After retrieving each resource

Bundler allows hooks to be registered to directly manipulate the body of a fetched resource through the `resourceReceived` event.  Such hooks have
the following signature.

```javascript
function handlerName(requestFn, options, body, diffs, response, callback) {
  // Make a diff object for the resource body
  callback(err, diff);
}
```

`requestFn` is a wrapper around the `request` library's exported function and can be used to fetch resources.

`options` is the options object passed to the request made to fetch the resource for which the `resourceReceived` event was triggered.

`body` contains the string contents of the resource in question.

`diffs` is a diff object containing the diffs for the resource assembled by previously-invoked hooks.

`response` contains the response object corresponding to the request for the resource in question.

`callback` is the `async.reduce` callback and must be invoked with any error that might have occurred (or null) and the new diff object to pass onto the next hook.

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

## bundler.mimetype(url)

Infers, where possible, the mimetype of a resource based on its URL.  It is better to determine this information from the Content-Type header in a response, however this function is provided as a useful helper.

## bundler.dataURI(response, baseURL, content)

Produces the data URI for a resource given the response object corresponding to the request for the resource, the base URL (e.g. www.google.com) for the resource, and the content of the resource as a [Buffer obect](http://nodejs.org/api/buffer.html).

## bundler.strReplaceAll(string, str1, str2)

Replaces all instances of `str1` in `string` with `str2`.

## bundler.applyDiffs(string, diffs)

Applies all the replacements provided by a diff object to a given string.
For example, the string `"abc"` with diff `{'c': 'd'}` would become `"abd"`.

## bundler.htmlFinder(source, selector, attr)

Returns a function that accepts a callback. Will scan through an HTML document 
`source` and invoke the callback with the value of the attribute of each element obtained using the provided selector. This works using the 
[Cheerio](https://github.com/cheeriojs/cheerio) library, so selectors should be supplied accordingly.

## bundler.cssReferenceFinder(source)

Like `htmlFinder`, will return a function that accepts a callback.  The callback will be invoked with the URL found within all instances of calls to 
`url()` in the CSS document `source` provided.

## bundler.replaceAll(request, url, finder, callback)

Uses a finder (the callback-accepting function provided by a call to either `htmlFinder` or `cssReferenceFinder`) to identify and request resources. The `url` argument must be the URL of the original document (e.g. www.google.com). The callback will be invoked with any error that occurs (or null) and a diff object.
