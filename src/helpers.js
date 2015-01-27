/**********************
 ** Helper Functions **
 **********************
 *
 * Functions made to assist in writing handlers and hooks.
 */

var mime = require('mime');

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
  }
};
