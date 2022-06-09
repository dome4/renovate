"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.smartTruncate = void 0;
const re = new RegExp(`(?<preNotes>.*### Release Notes)(?<releaseNotes>.*)### Configuration(?<postNotes>.*)`, 's');
function smartTruncate(input, len) {
    if (input.length < len) {
        return input;
    }
    const reMatch = re.exec(input);
    if (!reMatch) {
        return input.substring(0, len);
    }
    const divider = `\n\n</details>\n\n---\n\n### Configuration`;
    const preNotes = reMatch.groups?.preNotes ?? '';
    const releaseNotes = reMatch.groups?.releaseNotes ?? '';
    const postNotes = reMatch.groups?.postNotes ?? '';
    const availableLength = len - (preNotes.length + postNotes.length + divider.length);
    if (availableLength <= 0) {
        return input.substring(0, len);
    }
    else {
        return (preNotes + releaseNotes.slice(0, availableLength) + divider + postNotes);
    }
}
exports.smartTruncate = smartTruncate;
//# sourceMappingURL=pr-body.js.map