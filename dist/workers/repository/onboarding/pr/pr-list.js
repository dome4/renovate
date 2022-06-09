"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPrList = void 0;
const logger_1 = require("../../../../logger");
const emoji_1 = require("../../../../util/emoji");
const regex_1 = require("../../../../util/regex");
function getPrList(config, branches) {
    logger_1.logger.debug('getPrList()');
    logger_1.logger.trace({ config });
    let prDesc = `\n### What to Expect\n\n`;
    if (!branches.length) {
        return `${prDesc}It looks like your repository dependencies are already up-to-date and no Pull Requests will be necessary right away.\n`;
    }
    prDesc += `With your current configuration, Renovate will create ${branches.length} Pull Request`;
    prDesc += branches.length > 1 ? `s:\n\n` : `:\n\n`;
    for (const branch of branches) {
        const prTitleRe = (0, regex_1.regEx)(/@([a-z]+\/[a-z]+)/);
        prDesc += `<details>\n<summary>${branch.prTitle.replace(prTitleRe, '@&#8203;$1')}</summary>\n\n`;
        if (branch.schedule?.length) {
            prDesc += `  - Schedule: ${JSON.stringify(branch.schedule)}\n`;
        }
        prDesc += `  - Branch name: \`${branch.branchName}\`\n`;
        prDesc += branch.baseBranch
            ? `  - Merge into: \`${branch.baseBranch}\`\n`
            : '';
        const seen = [];
        for (const upgrade of branch.upgrades) {
            let text = '';
            if (upgrade.updateType === 'lockFileMaintenance') {
                text += '  - Regenerate lock files to use latest dependency versions';
            }
            else {
                if (upgrade.updateType === 'pin') {
                    text += '  - Pin ';
                }
                else {
                    text += '  - Upgrade ';
                }
                if (upgrade.sourceUrl) {
                    text += `[${upgrade.depName}](${upgrade.sourceUrl})`;
                }
                else {
                    text += upgrade.depName.replace(prTitleRe, '@&#8203;$1');
                }
                text += upgrade.isLockfileUpdate
                    ? ` to \`${upgrade.newVersion}\``
                    : ` to \`${upgrade.newDigest || upgrade.newValue}\``;
                text += '\n';
            }
            if (!seen.includes(text)) {
                prDesc += text;
                seen.push(text);
            }
        }
        prDesc += '\n\n';
        prDesc += '</details>\n\n';
    }
    if (config.prHourlyLimit > 0 &&
        config.prHourlyLimit < 5 &&
        config.prHourlyLimit < branches.length) {
        prDesc += (0, emoji_1.emojify)(`<br />\n\n:children_crossing: Branch creation will be limited to maximum ${config.prHourlyLimit} per hour, so it doesn't swamp any CI resources or spam the project. See docs for \`prhourlylimit\` for details.\n\n`);
    }
    return prDesc;
}
exports.getPrList = getPrList;
//# sourceMappingURL=pr-list.js.map