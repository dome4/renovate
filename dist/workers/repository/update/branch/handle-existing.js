"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlepr = void 0;
const tslib_1 = require("tslib");
const global_1 = require("../../../../config/global");
const logger_1 = require("../../../../logger");
const comment_1 = require("../../../../modules/platform/comment");
const types_1 = require("../../../../types");
const git_1 = require("../../../../util/git");
const template = tslib_1.__importStar(require("../../../../util/template"));
async function handlepr(config, pr) {
    if (pr.state === types_1.PrState.Closed) {
        let content;
        if (config.updateType === 'major') {
            content = template.compile(config.userStrings.ignoreMajor, config);
        }
        else if (config.updateType === 'digest') {
            content = template.compile(config.userStrings.ignoreDigest, config);
        }
        else {
            content = template.compile(config.userStrings.ignoreOther, config);
        }
        content +=
            '\n\nIf this PR was closed by mistake or you changed your mind, you can simply rename this PR and you will soon get a fresh replacement PR opened.';
        if (!config.suppressNotifications.includes('prIgnoreNotification')) {
            if (global_1.GlobalConfig.get('dryRun')) {
                logger_1.logger.info(`DRY-RUN: Would ensure closed PR comment in PR #${pr.number}`);
            }
            else {
                await (0, comment_1.ensureComment)({
                    number: pr.number,
                    topic: config.userStrings.ignoreTopic,
                    content,
                });
            }
        }
        if ((0, git_1.branchExists)(config.branchName)) {
            if (global_1.GlobalConfig.get('dryRun')) {
                logger_1.logger.info('DRY-RUN: Would delete branch ' + config.branchName);
            }
            else {
                await (0, git_1.deleteBranch)(config.branchName);
            }
        }
    }
    else if (pr.state === types_1.PrState.Merged) {
        logger_1.logger.debug({ pr: pr.number }, 'Merged PR is blocking this branch');
    }
}
exports.handlepr = handlepr;
//# sourceMappingURL=handle-existing.js.map