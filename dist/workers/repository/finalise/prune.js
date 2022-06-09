"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pruneStaleBranches = void 0;
const global_1 = require("../../../config/global");
const error_messages_1 = require("../../../constants/error-messages");
const logger_1 = require("../../../logger");
const platform_1 = require("../../../modules/platform");
const comment_1 = require("../../../modules/platform/comment");
const types_1 = require("../../../types");
const git_1 = require("../../../util/git");
async function cleanUpBranches({ pruneStaleBranches: enabled }, remainingBranches) {
    if (enabled === false) {
        logger_1.logger.debug('Branch/PR pruning is disabled - skipping');
        return;
    }
    for (const branchName of remainingBranches) {
        try {
            const pr = await platform_1.platform.findPr({
                branchName,
                state: types_1.PrState.Open,
            });
            const branchIsModified = await (0, git_1.isBranchModified)(branchName);
            if (pr) {
                if (branchIsModified) {
                    logger_1.logger.debug({ prNo: pr.number, prTitle: pr.title }, 'Branch is modified - skipping PR autoclosing');
                    if (global_1.GlobalConfig.get('dryRun')) {
                        logger_1.logger.info(`DRY-RUN: Would add Autoclosing Skipped comment to PR`);
                    }
                    else {
                        await (0, comment_1.ensureComment)({
                            number: pr.number,
                            topic: 'Autoclosing Skipped',
                            content: 'This PR has been flagged for autoclosing, however it is being skipped due to the branch being already modified. Please close/delete it manually or report a bug if you think this is in error.',
                        });
                    }
                }
                else if (global_1.GlobalConfig.get('dryRun')) {
                    logger_1.logger.info({ prNo: pr.number, prTitle: pr.title }, `DRY-RUN: Would autoclose PR`);
                }
                else {
                    logger_1.logger.info({ branchName, prNo: pr.number, prTitle: pr.title }, 'Autoclosing PR');
                    let newPrTitle = pr.title;
                    if (!pr.title.endsWith('- autoclosed')) {
                        newPrTitle += ' - autoclosed';
                    }
                    await platform_1.platform.updatePr({
                        number: pr.number,
                        prTitle: newPrTitle,
                        state: types_1.PrState.Closed,
                    });
                    await (0, git_1.deleteBranch)(branchName);
                }
            }
            else if (global_1.GlobalConfig.get('dryRun')) {
                logger_1.logger.info(`DRY-RUN: Would delete orphan branch ${branchName}`);
            }
            else {
                logger_1.logger.info({ branch: branchName }, `Deleting orphan branch`);
                await (0, git_1.deleteBranch)(branchName);
            }
        }
        catch (err) /* istanbul ignore next */ {
            if (err.message === 'config-validation') {
                logger_1.logger.debug('Cannot prune branch due to collision between tags and branch names');
            }
            else if (err.message?.includes("bad revision 'origin/")) {
                logger_1.logger.debug({ branchName }, 'Branch not found on origin when attempting to prune');
            }
            else if (err.message !== error_messages_1.REPOSITORY_CHANGED) {
                logger_1.logger.warn({ err, branch: branchName }, 'Error pruning branch');
            }
        }
    }
}
async function pruneStaleBranches(config, branchList) {
    logger_1.logger.debug('Removing any stale branches');
    logger_1.logger.trace({ config }, `pruneStaleBranches`);
    logger_1.logger.debug(`config.repoIsOnboarded=${config.repoIsOnboarded}`);
    if (!branchList) {
        logger_1.logger.debug('No branchList');
        return;
    }
    let renovateBranches = (0, git_1.getBranchList)().filter((branchName) => branchName.startsWith(config.branchPrefix));
    if (!renovateBranches?.length) {
        logger_1.logger.debug('No renovate branches found');
        return;
    }
    logger_1.logger.debug({
        branchList: branchList?.sort(),
        renovateBranches: renovateBranches?.sort(),
    }, 'Branch lists');
    const lockFileBranch = `${config.branchPrefix}lock-file-maintenance`;
    renovateBranches = renovateBranches.filter((branch) => branch !== lockFileBranch);
    const remainingBranches = renovateBranches.filter((branch) => !branchList.includes(branch));
    logger_1.logger.debug(`remainingBranches=${String(remainingBranches)}`);
    if (remainingBranches.length === 0) {
        logger_1.logger.debug('No branches to clean up');
        return;
    }
    await cleanUpBranches(config, remainingBranches);
}
exports.pruneStaleBranches = pruneStaleBranches;
//# sourceMappingURL=prune.js.map