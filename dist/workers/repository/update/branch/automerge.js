"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tryBranchAutomerge = void 0;
const global_1 = require("../../../../config/global");
const logger_1 = require("../../../../logger");
const platform_1 = require("../../../../modules/platform");
const types_1 = require("../../../../types");
const git_1 = require("../../../../util/git");
const schedule_1 = require("./schedule");
const status_checks_1 = require("./status-checks");
async function tryBranchAutomerge(config) {
    logger_1.logger.debug('Checking if we can automerge branch');
    if (!(config.automerge && config.automergeType === 'branch')) {
        return 'no automerge';
    }
    if (!(0, schedule_1.isScheduledNow)(config, 'automergeSchedule')) {
        return 'off schedule';
    }
    const existingPr = await platform_1.platform.getBranchPr(config.branchName);
    if (existingPr) {
        return 'automerge aborted - PR exists';
    }
    const branchStatus = await (0, status_checks_1.resolveBranchStatus)(config.branchName, config.ignoreTests);
    if (branchStatus === types_1.BranchStatus.green) {
        logger_1.logger.debug(`Automerging branch`);
        try {
            if (global_1.GlobalConfig.get('dryRun')) {
                logger_1.logger.info(`DRY-RUN: Would automerge branch ${config.branchName}`);
            }
            else {
                await (0, git_1.mergeBranch)(config.branchName);
            }
            logger_1.logger.info({ branch: config.branchName }, 'Branch automerged');
            return 'automerged'; // Branch no longer exists
        }
        catch (err) /* istanbul ignore next */ {
            if (err.message === 'not ready') {
                logger_1.logger.debug('Branch is not ready for automerge');
                return 'not ready';
            }
            if (err.message.includes('refusing to merge unrelated histories') ||
                err.message.includes('Not possible to fast-forward') ||
                err.message.includes('Updates were rejected because the tip of your current branch is behind')) {
                logger_1.logger.debug({ err }, 'Branch automerge error');
                logger_1.logger.info('Branch is not up to date - cannot automerge');
                return 'stale';
            }
            if (err.message.includes('Protected branch')) {
                if (err.message.includes('status check')) {
                    logger_1.logger.debug({ err }, 'Branch is not ready for automerge: required status checks are remaining');
                    return 'not ready';
                }
                if (err.stack?.includes('reviewers')) {
                    logger_1.logger.info({ err }, 'Branch automerge is not possible due to branch protection (required reviewers)');
                    return 'failed';
                }
                logger_1.logger.info({ err }, 'Branch automerge is not possible due to branch protection');
                return 'failed';
            }
            logger_1.logger.warn({ err }, 'Unknown error when attempting branch automerge');
            return 'failed';
        }
    }
    else if (branchStatus === types_1.BranchStatus.red) {
        return 'branch status error';
    }
    else {
        logger_1.logger.debug(`Branch status is "${branchStatus}" - skipping automerge`);
    }
    return 'no automerge';
}
exports.tryBranchAutomerge = tryBranchAutomerge;
//# sourceMappingURL=automerge.js.map