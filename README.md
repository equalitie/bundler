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

# Testing

To run the module test script, simply run the command

    npm test

from the project root folder.
