"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getChangelogs = void 0;
const tslib_1 = require("tslib");
const emoji_1 = require("../../../../../util/emoji");
const markdown_1 = require("../../../../../util/markdown");
const regex_1 = require("../../../../../util/regex");
const template = tslib_1.__importStar(require("../../../../../util/template"));
const hbs_template_1 = tslib_1.__importDefault(require("../changelog/hbs-template"));
function getChangelogs(config) {
    let releaseNotes = '';
    if (!config.hasReleaseNotes) {
        return releaseNotes;
    }
    const countReleaseNodesByRepoName = {};
    for (const upgrade of config.upgrades) {
        if (upgrade.hasReleaseNotes && upgrade.repoName) {
            countReleaseNodesByRepoName[upgrade.repoName] =
                (countReleaseNodesByRepoName[upgrade.repoName] || 0) + 1;
        }
    }
    for (const upgrade of config.upgrades) {
        if (upgrade.hasReleaseNotes && upgrade.repoName) {
            upgrade.releaseNotesSummaryTitle = `${upgrade.repoName}${countReleaseNodesByRepoName[upgrade.repoName] > 1
                ? ` (${upgrade.depName})`
                : ''}`;
        }
    }
    releaseNotes +=
        '\n\n---\n\n' + template.compile(hbs_template_1.default, config, false) + '\n\n';
    releaseNotes = releaseNotes.replace((0, regex_1.regEx)(/### \[`vv/g), '### [`v');
    releaseNotes = (0, markdown_1.sanitizeMarkdown)(releaseNotes);
    releaseNotes = (0, emoji_1.unemojify)(releaseNotes);
    return releaseNotes;
}
exports.getChangelogs = getChangelogs;
//# sourceMappingURL=changelogs.js.map