"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPrBodyStruct = exports.isRebaseRequested = exports.hashBody = void 0;
const tslib_1 = require("tslib");
const hasha_1 = tslib_1.__importDefault(require("hasha"));
const emoji_1 = require("../../util/emoji");
const regex_1 = require("../../util/regex");
function noWhitespaceOrHeadings(input) {
    return input.replace((0, regex_1.regEx)(/\r?\n|\r|\s|#/g), '');
}
const reviewableRegex = (0, regex_1.regEx)(/\s*<!-- Reviewable:start -->/);
function hashBody(body) {
    let result = body?.trim() ?? '';
    const reviewableIndex = result.search(reviewableRegex);
    if (reviewableIndex > -1) {
        result = result.slice(0, reviewableIndex);
    }
    result = (0, emoji_1.stripEmojis)(result);
    result = noWhitespaceOrHeadings(result);
    result = (0, hasha_1.default)(result, { algorithm: 'sha256' });
    return result;
}
exports.hashBody = hashBody;
function isRebaseRequested(body) {
    return !!body?.includes(`- [x] <!-- rebase-check -->`);
}
exports.isRebaseRequested = isRebaseRequested;
function getPrBodyStruct(input) {
    const str = input ?? '';
    const hash = hashBody(str);
    const result = { hash };
    const rebaseRequested = isRebaseRequested(str);
    if (rebaseRequested) {
        result.rebaseRequested = rebaseRequested;
    }
    return result;
}
exports.getPrBodyStruct = getPrBodyStruct;
//# sourceMappingURL=pr-body.js.map