"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.linkify = exports.sanitizeMarkdown = void 0;
const tslib_1 = require("tslib");
const remark_1 = tslib_1.__importDefault(require("remark"));
const remark_github_1 = tslib_1.__importDefault(require("remark-github"));
const regex_1 = require("./regex");
// Generic replacements/link-breakers
function sanitizeMarkdown(markdown) {
    let res = markdown;
    // Put a zero width space after every # followed by a digit
    res = res.replace((0, regex_1.regEx)(/#(\d)/gi), '#&#8203;$1');
    // Put a zero width space after every @ symbol to prevent unintended hyperlinking
    res = res.replace((0, regex_1.regEx)(/@/g), '@&#8203;');
    res = res.replace((0, regex_1.regEx)(/(`\[?@)&#8203;/g), '$1');
    res = res.replace((0, regex_1.regEx)(/([a-z]@)&#8203;/gi), '$1');
    res = res.replace((0, regex_1.regEx)(/\/compare\/@&#8203;/g), '/compare/@');
    res = res.replace((0, regex_1.regEx)(/(\(https:\/\/[^)]*?)\.\.\.@&#8203;/g), '$1...@');
    res = res.replace((0, regex_1.regEx)(/([\s(])#(\d+)([)\s]?)/g), '$1#&#8203;$2$3');
    // convert escaped backticks back to `
    const backTickRe = (0, regex_1.regEx)(/&#x60;([^/]*?)&#x60;/g);
    res = res.replace(backTickRe, '`$1`');
    res = res.replace((0, regex_1.regEx)(/`#&#8203;(\d+)`/g), '`#$1`');
    return res;
}
exports.sanitizeMarkdown = sanitizeMarkdown;
/**
 *
 * @param content content to process
 * @param options github options
 * @returns linkified content
 */
async function linkify(content, options) {
    // https://github.com/syntax-tree/mdast-util-to-markdown#optionsbullet
    const output = await (0, remark_1.default)()
        .use({ settings: { bullet: '-' } })
        .use(remark_github_1.default, { mentionStrong: false, ...options })
        .process(content);
    return output.toString();
}
exports.linkify = linkify;
//# sourceMappingURL=markdown.js.map