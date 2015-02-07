/**********************
 ** Helper Functions **
 **********************
 *
 * Functions made to assist in writing handlers and hooks.
 */

var mime = require('mime');
var css = require('css');

module.exports = {
  mimetype: function (url) {
    var i = url.lastIndexOf('.');
    var defaultMT = 'text/plain';
    if (i < 0) {
      return defaultMT;
    }
    var ext = '.' + url.substring(i, url.length);
    ext = ext.match(/\.\w+/);
    if (ext) {
      return mime.lookup(ext[0]);
    }
    return defaultMT;
  },

  dataURI: function (url, content) {
    var encoded = content.toString('base64');
    return 'data:' + this.mimetype(url) + ';base64,' + encoded;
  },

  cssReferenceFinder: function (source) {
    var parseTree = css.parse(source);
    return function (callback) {
      var rules = parseTree.stylesheet.rules;
      for (var i = 0, len = rules.length; i < len; ++i) {
        var declarations = rules[i].declarations;
        for (var j = 0, len2 = declarations.length; j < len2; ++j) {
          var value = declarations[j].value;
          if (value.substring(0, 4) === 'url(') {
            var start = 3;
            var end = value.lastIndexOf(')');
            callback(value.substring(start, end + 1));
          }
        }
      }
    };
  }
};
