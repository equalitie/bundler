# bundler

A utility for bundling resources in web pages into a single page by inlining them
using the [data URI scheme](https://en.wikipedia.org/wiki/Data_URI_scheme).

It is designed to be easy to use from any context so that one can simply:

* Put a server in front of bundler to bundle pages for proxied requests
* Bundle pages served by an application
* Build utilities to bundle pages

and so on. 

# Basic Usage

The majority of the functionality most users will be concerned with is exposed through
the `makeBundle` function exported by the `bundler` module. It has the following
[signature](https://github.com/equalitie/bundler/blob/master/src/bundler.js#L166):

    function makeBundle(url, handlers, callback)

1. `url` is the URL of the page to fetch and bundle, e.g. `https://google.com`
2. `handlers` is an array of resource-replacing handlers to be called to do the bundling
3. `callback` is a callback that will be called with
  1. `err`, an optional error that may be result from a handler call or a failed request
  2. `bundle`, the bundled web page as a string

Currently, bundler exports the following handlers:

* replaceImages
* replaceCSSFiles
* replaceJSFiles

which replace references to images, CSS files, and Javascript source files respectively.

# Custom handlers

While bundler is sure to provide more handlers in the future, it may suit your purposes
to define your own handler to do new pieces of work. The signature for a handler function
is

    function handlerName($, url, callback)

1. `$` is a [Cheerio](https://github.com/cheeriojs/cheerio) object loaded with the HTML of the page being bundled
2. `url` is the original URL of the page being bundled, e.g. `https://google.com`
3. `callback` is a callback called by [async.parallel](https://github.com/caolan/async#parallel) to iterate through handlers

Note here that the callback is not something is exposed to the programmer to make use of
intermediate results handlers produce, but is simply pushed along to `async.parallel`.

# Testing

To run the module test script, simply run the command

    npm test

from the project root folder.
