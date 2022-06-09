"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uniqueStrings = exports.fromBase64 = exports.toBase64 = exports.replaceAt = exports.matchAt = void 0;
const logger_1 = require("../logger");
// Return true if the match string is found at index in content
function matchAt(content, index, match) {
    return content.substring(index, index + match.length) === match;
}
exports.matchAt = matchAt;
// Replace oldString with newString at location index of content
function replaceAt(content, index, oldString, newString) {
    logger_1.logger.trace(`Replacing ${oldString} with ${newString} at index ${index}`);
    return (content.substr(0, index) +
        newString +
        content.substr(index + oldString.length));
}
exports.replaceAt = replaceAt;
/**
 * Converts from utf-8 string to base64-encoded string
 */
function toBase64(input) {
    return Buffer.from(input).toString('base64');
}
exports.toBase64 = toBase64;
/**
 * Converts from base64-encoded string to utf-8 string
 */
function fromBase64(input) {
    return Buffer.from(input, 'base64').toString();
}
exports.fromBase64 = fromBase64;
function uniqueStrings(element, index, elements) {
    return elements.indexOf(element) === index;
}
exports.uniqueStrings = uniqueStrings;
//# sourceMappingURL=string.js.map