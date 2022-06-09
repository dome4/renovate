"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPrConfigDescription = void 0;
const types_1 = require("../../../../../types");
const emoji_1 = require("../../../../../util/emoji");
const status_checks_1 = require("../../branch/status-checks");
async function getPrConfigDescription(config) {
    let prBody = `\n\n---\n\n### Configuration\n\n`;
    prBody += (0, emoji_1.emojify)(`:date: **Schedule**: `);
    prBody +=
        'Branch creation - ' + scheduleToString(config.schedule, config.timezone);
    prBody +=
        ', Automerge - ' +
            scheduleToString(config.automergeSchedule, config.timezone) +
            '.';
    prBody += '\n\n';
    prBody += (0, emoji_1.emojify)(':vertical_traffic_light: **Automerge**: ');
    if (config.automerge) {
        const branchStatus = await (0, status_checks_1.resolveBranchStatus)(config.branchName, config.ignoreTests);
        if (branchStatus === types_1.BranchStatus.red) {
            prBody += 'Disabled due to failing status checks.';
        }
        else {
            prBody += 'Enabled.';
        }
    }
    else {
        prBody +=
            'Disabled by config. Please merge this manually once you are satisfied.';
    }
    prBody += '\n\n';
    prBody += (0, emoji_1.emojify)(':recycle: **Rebasing**: ');
    if (config.rebaseWhen === 'behind-base-branch') {
        prBody += 'Whenever PR is behind base branch';
    }
    else if (config.rebaseWhen === 'never' || config.stopUpdating) {
        prBody += 'Never';
    }
    else {
        prBody += 'Whenever PR becomes conflicted';
    }
    prBody += `, or you tick the rebase/retry checkbox.\n\n`;
    if (config.recreateClosed) {
        prBody += (0, emoji_1.emojify)(`:ghost: **Immortal**: This PR will be recreated if closed unmerged. Get [config help](${config.productLinks?.help}) if that's undesired.\n\n`);
    }
    else {
        prBody += (0, emoji_1.emojify)(`:no_bell: **Ignore**: Close this PR and you won't be reminded about ${config.upgrades.length === 1 ? 'this update' : 'these updates'} again.\n\n`);
    }
    return prBody;
}
exports.getPrConfigDescription = getPrConfigDescription;
function scheduleToString(schedule, timezone) {
    let scheduleString = '';
    if (schedule && schedule[0] !== 'at any time') {
        scheduleString += `"${String(schedule)}"`;
        if (timezone) {
            scheduleString += ` in timezone ${timezone}`;
        }
        else {
            scheduleString += ` (UTC)`;
        }
    }
    else {
        scheduleString += 'At any time (no schedule defined)';
    }
    return scheduleString;
}
//# sourceMappingURL=config-description.js.map