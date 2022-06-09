"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPrExtraNotes = exports.getPrNotes = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const logger_1 = require("../../../../../logger");
const emoji_1 = require("../../../../../util/emoji");
const template = tslib_1.__importStar(require("../../../../../util/template"));
function getPrNotes(config) {
    const notes = [];
    for (const upgrade of config.upgrades) {
        if (is_1.default.nonEmptyArray(upgrade.prBodyNotes)) {
            for (const note of upgrade.prBodyNotes) {
                try {
                    const res = template.compile(note, upgrade).trim();
                    if (res?.length) {
                        notes.push(res);
                    }
                }
                catch (err) {
                    logger_1.logger.warn({ note }, 'Error compiling upgrade note');
                }
            }
        }
    }
    const uniqueNotes = [...new Set(notes)];
    return uniqueNotes.join('\n\n') + '\n\n';
}
exports.getPrNotes = getPrNotes;
function getPrExtraNotes(config) {
    let res = '';
    if (config.upgrades.some((upgrade) => upgrade.gitRef)) {
        res += (0, emoji_1.emojify)(':abcd: If you wish to disable git hash updates, add `":disableDigestUpdates"` to the extends array in your config.\n\n');
    }
    if (config.updateType === 'lockFileMaintenance') {
        res += (0, emoji_1.emojify)(':wrench: This Pull Request updates lock files to use the latest dependency versions.\n\n');
    }
    if (config.isPin) {
        res += (0, emoji_1.emojify)(`Add the preset \`:preserveSemverRanges\` to your config if you don't want to pin your dependencies.\n\n`);
    }
    return res;
}
exports.getPrExtraNotes = getPrExtraNotes;
//# sourceMappingURL=notes.js.map