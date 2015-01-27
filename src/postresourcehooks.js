/**************************
 ** Post-Resources Hooks **
 **************************
 *
 * Functions to invoke to modify, filter, and inspect the replacements
 * to be made to the originally fetched page's source code.
 */

module.exports = {
  // Filter out replacements that we might not want to apply.
  // First argument to predicate is the resource's original URL.
  // Second argument is the generated data URI.
  filterReplacements: function (predicate) {
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
};
