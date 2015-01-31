/************************
 ** Pre-Resource Hooks **
 ************************
 *
 * Functions called before a request for a resource is issued.
 * Allows for the inspection of the original request's response,
 * inspection and modification of the Cheerio object containing
 * the page's content, and setting of attributes for the resource
 * request passed to `request`.
 * Arguments are as follows:
 *   options  - The current object containing `request` options.
 *   next     - The iterator function passed by `async.reduce`.
 *   $        - The Cheerio object containing the original document.
 *   response - The response object from the original document request.
 * The decision to make `options` and `next` the first to arguments was
 * made so that the hooks from `requestmodifiers.js` can be used seamlessly.
 */

/* Note:
 * These functions are stubs for now because it remains to be determined
 * whether the kind of functionality we want to be able to support will
 * need more or different data, such as a request object to manipulate.
 */
module.exports = {
};
