/**************************
 ** Post-Resources Hooks **
 **************************
 *
 * Functions to invoke to modify, filter, and inspect the replacements
 * to be made to the originally fetched page's source code.
 */

module.exports = function (logger) {
  return {
  /**
   * Filter out replacements that we might not want to apply to the document being bundled.
   * @param {function} predicate - The predicate to test whether we want to keep a diff
   */
  filterDiffs: function (predicate) {
    return function (diffs, callback) {
      var newDiffs = {};
      var sources = Object.keys(diffs);
      for (var i = 0, len = sources.length; i < len; ++i) {
        if (predicate(sources[i], diffs[sources[i]])) {
          newDiffs[sources[i]] = diffs[sources[i]];
        }
      }
      callback(null, newDiffs);
    };
  }
  }; // END RETURN OBJECT
}    // END MODULE DEFINITION
