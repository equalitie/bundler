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
(new bundler.makeBundler('https://news.ycombinator.com'))
  .useHandler(bundler.resources.replaceImages)
  .send(function (err, bundle) {
    console.log(bundle); 
  });
```

Currently, there are three resource handlers in `bundler.resources`:

1. replaceImages
2. replaceCSSFiles
3. replaceJSFiles

which all do exactly what you would expect.

More on writing your own resource handlers in the *Writing Your Own Hooks*
section below.

# Using Hooks

![Architectural diagram](https://raw.githubusercontent.com/equalitie/bundler/master/architecture.png)

Bundler provides three opportunities to inject new functionality into the
bundling process.

1. Before fetching the first, original document
2. Before fetching any resource referenced by the original document
3. After accumulating a collection of resource URLs and their data URIs

## Before fetching the original document

Because one may wish to modify request headers, among other things, bundler
allows for hooks to be called before making a request for the original document.
For example, to replace the `Referer` header with `https://duckduckgo.com`:

```javascript
(new bundler.makeBundler('https://yahoo.com'))
  .useHandler(bundler.resources.replaceImages)
  .useHandler(bundler.resources.replaceCSSFiles)
  .beforeOriginalRequest(bundler.modifyRequests.spoofHeaders({
    'Referer': 'https://duckduckgo.com'
  }))
  .send(function (err, bundle) {
    console.log(bundle);
  });
```

Currently, the `bundler.modifyRequests` includes:

1. stripHeaders([header1, header2, ...])
2. spoofHeaders({header1: replacement1, header2: replacement2, ...})

## Before fetching each resource

Bundler allows request options to be set for each resource that is to be retrieved.
The functions from `bundler.modifyRequests` can be reused here.  For example:

```javascript
(new bundler.makeBundler('https://yahoo.com'))
  .useHandler(bundler.resources.replaceImages)
  .useHandler(bundler.resources.replaceCSSFiles)
  .beforeFetchingResources(bundler.modifyRequests.spoofHeaders({
    'Referer': 'https://duckduckgo.com'
  }))
  .send(function (err, bundle) {
    console.log(bundle);
  });
```

Note that the only difference between this example and the one in the first section
is that this one registers hooks with the `beforeFetchingResources` method.

*Currently no special handlers are implemented here*

## After building data URIs

In case one would like to prevent bundler from making certain kinds of replacements,
for example if a data URI is too long or the resource is hosted on a particular site,
one can register hooks to be run when a collection of resource URLs and their
corresponding data URIs has been compiled. 

Currently, `bundler.modifyReplacements.filter` is the only existing hook exported
for this purpose. An example of filtering out resources that appear to be hosted
on `google.com`:

```javascript
(new bundler.makeBundler(url))
  .useHandler(bundler.resources.replaceJSFiles)
  .afterFetchingResources(bundler.modifyReplacements.filter(function (resource, datauri) {
    return resource.indexOf('google.com') < 0;
  }))
  .send(function (err, bundle) {
    console.log(bundle);
  });
```

# Writing your own hooks

It is, of course, possible to write your own hooks to use in any of the cases outlined
above. Each type of hook has a different signature but are expected to behave in
approximately the same ways.

## Before fetching the original document

Hooks to be added to the Bundler object using the `beforeOriginalRequest` method
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
(new bundler.makeBundler(url))
  .useHandler(bundler.resources.replaceImages)
  .beforeOriginalRequest(function (options, callback) {
    bundleRequests++;
    callback(null, options);
  })
  .send(function (err, bundle) {
    console.log(bundle);
  });
```

## Before fetching each resource

Hooks to be added to the Bundler object using the `beforeFetchingResources` method
should have the following form:

```javascript```
function handlerName(options, callback, $, response) {
  // Do something with options
  callback(err, options);
}
```

You will notice that this form is very similar to that of the handler described above.
This is intentional.  The signature for these handlers is a little unusual looking
(having the `callback` before `$` and `response` arguments), however this is done so
that the same handlers written for `beforeOriginalRequest` can be reused here.

The `options` and `callback` arguments here are the same as they are for the
`beforeOriginalRequest` handlers.

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
(new bundler.makeBundler(url))
  .useHandler(bundler.resources.replaceImages)
  .beforeFetchingResources(function (options, callback, $, response) {
    if (!options.hasOwnProperty('headers')) {
      options.headers = {};
    }
    options.headers['Referer'] = response.headers['host'];
    callback(null, options);
  })
  .send(function (err, bundle) {
    console.log(bundle);
  });
```

## After building data URIs

Hooks to be added to the Bundler object using the `afterFetchingResources` method
should have the following form.

```javascript
function handlerName(diffs, callback) {
  // Do something with diffs
  callback(err, diffs);
}
```

Here, `diffs` is an object whose keys are resource URLs and whose values are data
URIs.

One could write a handler to count the number of images, CSS files, and JS files
having replacements made with the following hook.

```javascript
var cssReplaces = 0;
var jsReplaces = 0;
var imgReplaces = 0;

(new bundler.makeBundler(url))
  .useHandler(bundler.resources.replaceImages)
  .useHandler(bundler.resources.replaceCSSFiles)
  .useHandler(bundler.resources.replaceJSFiles)
  .afterFetchingResources(function (diffs, callback) {
    var sources = Object.keys(diffs);
    for (var i = 0, len = sources.length; i < len; ++i) {
      switch (bundler.helpers.mimetype(sources[i])) {
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
  })
  .send(function (err, bundle) {
    console.log(bundle);
    console.log(cssReplaces + '\t CSS files replaced');
    console.log(jsReplaces + '\t JS files replaced');
    console.log(imgReplaces + '\t image files replaced');
  });
```

# Helper functions

To make writing handlers and hooks a little bit easier, Bundler exports the
following helper functions:

* `bundler.helpers.mimetype` returns the mimetype of a resource given its URL.
* `bundler.helpers.dataURI` returns the data URI for a resource given its URL and content in a buffer.

## Examples

### helpers.mimetype

```javascript
bundler.helpers.mimetype('/stylesheets/hello.css?hello=world');
// -> 'text/css'

bundler.helpers.mimetype('image.png');
// -> 'image/png'
```

### helpers.dataURI

```javascript
bundler.helpers.dataURI('test.css', new Buffer('h1 {  color: red; }'));
// -> 'data:text/css;base64,aDEgeyAgY29sb3I6IHJlZDsgfQ=='

bundler.helpers.dataURI('https://site.com/awesome/code.js', new Buffer('alert("Hello world");'));
// -> 'data:application/javascript;base64,YWxlcnQoIkhlbGxvIHdvcmxkIik7'
```

# Testing

To run the module test script, simply run the command

    npm test

from the project root folder.
