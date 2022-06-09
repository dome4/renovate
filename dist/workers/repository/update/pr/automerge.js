"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAutoMerge = exports.PrAutomergeBlockReason = void 0;
const global_1 = require("../../../../config/global");
const logger_1 = require("../../../../logger");
const platform_1 = require("../../../../modules/platform");
const comment_1 = require("../../../../modules/platform/comment");
const types_1 = require("../../../../types");
const git_1 = require("../../../../util/git");
const schedule_1 = require("../branch/schedule");
const status_checks_1 = require("../branch/status-checks");
// eslint-disable-next-line typescript-enum/no-enum
var PrAutomergeBlockReason;
(function (PrAutomergeBlockReason) {
    PrAutomergeBlockReason["BranchModified"] = "BranchModified";
    PrAutomergeBlockReason["BranchNotGreen"] = "BranchNotGreen";
    PrAutomergeBlockReason["Conflicted"] = "Conflicted";
    PrAutomergeBlockReason["DryRun"] = "DryRun";
    PrAutomergeBlockReason["PlatformNotReady"] = "PlatformNotReady";
    PrAutomergeBlockReason["PlatformRejection"] = "PlatformRejection";
    PrAutomergeBlockReason["OffSchedule"] = "off schedule";
})(PrAutomergeBlockReason = exports.PrAutomergeBlockReason || (exports.PrAutomergeBlockReason = {}));
async function checkAutoMerge(pr, config) {
    logger_1.logger.trace({ config }, 'checkAutoMerge');
    const { branchName, automergeType, automergeStrategy, pruneBranchAfterAutomerge, automergeComment, ignoreTests, rebaseRequested, } = config;
    // Return if PR not ready for automerge
    if (!(0, schedule_1.isScheduledNow)(config, 'automergeSchedule')) {
        logger_1.logger.debug(`PR automerge is off schedule`);
        return {
            automerged: false,
            prAutomergeBlockReason: PrAutomergeBlockReason.OffSchedule,
        };
    }
    const isConflicted = config.isConflicted ??
        (await (0, git_1.isBranchConflicted)(config.baseBranch, config.branchName));
    if (isConflicted) {
        logger_1.logger.debug('PR is conflicted');
        return {
            automerged: false,
            prAutomergeBlockReason: PrAutomergeBlockReason.Conflicted,
        };
    }
    if (!ignoreTests && pr.cannotMergeReason) {
        logger_1.logger.debug(`Platform reported that PR is not ready for merge. Reason: [${pr.cannotMergeReason}]`);
        return {
            automerged: false,
            prAutomergeBlockReason: PrAutomergeBlockReason.PlatformNotReady,
        };
    }
    const branchStatus = await (0, status_checks_1.resolveBranchStatus)(config.branchName, config.ignoreTests);
    if (branchStatus !== types_1.BranchStatus.green) {
        logger_1.logger.debug(`PR is not ready for merge (branch status is ${branchStatus})`);
        return {
            automerged: false,
            prAutomergeBlockReason: PrAutomergeBlockReason.BranchNotGreen,
        };
    }
    // Check if it's been touched
    if (await (0, git_1.isBranchModified)(branchName)) {
        logger_1.logger.debug('PR is ready for automerge but has been modified');
        return {
            automerged: false,
            prAutomergeBlockReason: PrAutomergeBlockReason.BranchModified,
        };
    }
    if (automergeType === 'pr-comment') {
        logger_1.logger.debug(`Applying automerge comment: ${automergeComment}`);
        // istanbul ignore if
        if (global_1.GlobalConfig.get('dryRun')) {
            logger_1.logger.info(`DRY-RUN: Would add PR automerge comment to PR #${pr.number}`);
            return {
                automerged: false,
                prAutomergeBlockReason: PrAutomergeBlockReason.DryRun,
            };
        }
        if (rebaseRequested) {
            await (0, comment_1.ensureCommentRemoval)({
                type: 'by-content',
                number: pr.number,
                content: automergeComment,
            });
        }
        await (0, comment_1.ensureComment)({
            number: pr.number,
            topic: null,
            content: automergeComment,
        });
        return { automerged: true, branchRemoved: false };
    }
    // Let's merge this
    // istanbul ignore if
    if (global_1.GlobalConfig.get('dryRun')) {
        logger_1.logger.info(`DRY-RUN: Would merge PR #${pr.number} with strategy "${automergeStrategy}"`);
        return {
            automerged: false,
            prAutomergeBlockReason: PrAutomergeBlockReason.DryRun,
        };
    }
    logger_1.logger.debug(`Automerging #${pr.number} with strategy ${automergeStrategy}`);
    const res = await platform_1.platform.mergePr({
        branchName,
        id: pr.number,
        strategy: automergeStrategy,
    });
    if (res) {
        logger_1.logger.info({ pr: pr.number, prTitle: pr.title }, 'PR automerged');
        if (!pruneBranchAfterAutomerge) {
            logger_1.logger.info('Skipping pruning of merged branch');
            return { automerged: true, branchRemoved: false };
        }
        let branchRemoved = false;
        try {
            await (0, git_1.deleteBranch)(branchName);
            branchRemoved = true;
        }
        catch (err) /* istanbul ignore next */ {
            logger_1.logger.warn({ branchName, err }, 'Branch auto-remove failed');
        }
        return { automerged: true, branchRemoved };
    }
    return {
        automerged: false,
        prAutomergeBlockReason: PrAutomergeBlockReason.PlatformRejection,
    };
}
exports.checkAutoMerge = checkAutoMerge;
//# sourceMappingURL=automerge.js.map