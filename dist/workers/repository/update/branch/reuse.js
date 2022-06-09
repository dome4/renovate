"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldReuseExistingBranch = void 0;
const global_1 = require("../../../../config/global");
const logger_1 = require("../../../../logger");
const platform_1 = require("../../../../modules/platform");
const git_1 = require("../../../../util/git");
async function shouldReuseExistingBranch(config) {
    const { baseBranch, branchName } = config;
    const result = { reuseExistingBranch: false };
    // Check if branch exists
    if (!(0, git_1.branchExists)(branchName)) {
        logger_1.logger.debug(`Branch needs creating`);
        return result;
    }
    logger_1.logger.debug(`Branch already exists`);
    // Check for existing PR
    const pr = await platform_1.platform.getBranchPr(branchName);
    if (pr) {
        if (pr.title?.startsWith('rebase!')) {
            logger_1.logger.debug(`Manual rebase requested via PR title for #${pr.number}`);
            return result;
        }
        if (pr.bodyStruct?.rebaseRequested) {
            logger_1.logger.debug(`Manual rebase requested via PR checkbox for #${pr.number}`);
            return result;
        }
        if (pr.labels?.includes(config.rebaseLabel)) {
            logger_1.logger.debug(`Manual rebase requested via PR labels for #${pr.number}`);
            // istanbul ignore if
            if (global_1.GlobalConfig.get('dryRun')) {
                logger_1.logger.info(`DRY-RUN: Would delete label ${config.rebaseLabel} from #${pr.number}`);
            }
            else {
                await platform_1.platform.deleteLabel(pr.number, config.rebaseLabel);
            }
            return result;
        }
    }
    if (config.rebaseWhen === 'behind-base-branch' ||
        (config.rebaseWhen === 'auto' &&
            (config.automerge || (await platform_1.platform.getRepoForceRebase())))) {
        if (await (0, git_1.isBranchStale)(branchName)) {
            logger_1.logger.debug(`Branch is stale and needs rebasing`);
            // We can rebase the branch only if no PR or PR can be rebased
            if (await (0, git_1.isBranchModified)(branchName)) {
                logger_1.logger.debug('Cannot rebase branch as it has been modified');
                result.reuseExistingBranch = true;
                result.isModified = true;
                return result;
            }
            logger_1.logger.debug('Branch is unmodified, so can be rebased');
            return result;
        }
        logger_1.logger.debug('Branch is up-to-date');
    }
    else {
        logger_1.logger.debug(`Skipping stale branch check due to rebaseWhen=${config.rebaseWhen}`);
    }
    // Now check if PR is unmergeable. If so then we also rebase
    result.isConflicted = await (0, git_1.isBranchConflicted)(baseBranch, branchName);
    if (result.isConflicted) {
        logger_1.logger.debug('Branch is conflicted');
        if ((await (0, git_1.isBranchModified)(branchName)) === false) {
            logger_1.logger.debug(`Branch is not mergeable and needs rebasing`);
            if (config.rebaseWhen === 'never') {
                logger_1.logger.debug('Rebasing disabled by config');
                result.reuseExistingBranch = true;
                result.isModified = false;
            }
            // Setting reuseExistingBranch back to undefined means that we'll use the default branch
            return result;
        }
        // Don't do anything different, but warn
        // TODO: Add warning to PR (#9720)
        logger_1.logger.debug(`Branch is not mergeable but can't be rebased`);
    }
    logger_1.logger.debug(`Branch does not need rebasing`);
    // Branches can get in an inconsistent state if "update-lockfile" is used at the same time as other strategies
    // On the first execution, everything is executed, but if on a second execution the package.json modification is
    // skipped but the lockfile update is executed, the lockfile will have a different result than if it was executed
    // along with the changes to the package.json. Thus ending up with an incomplete branch update
    // This is why we are skipping branch reuse in this case (#10050)
    const groupedByPackageFile = {};
    for (const upgrade of config.upgrades) {
        groupedByPackageFile[upgrade.packageFile] =
            groupedByPackageFile[upgrade.packageFile] || new Set();
        groupedByPackageFile[upgrade.packageFile].add(upgrade.rangeStrategy);
        if (groupedByPackageFile[upgrade.packageFile].size > 1 &&
            groupedByPackageFile[upgrade.packageFile].has('update-lockfile')) {
            logger_1.logger.debug(`Detected multiple rangeStrategies along with update-lockfile`);
            result.reuseExistingBranch = false;
            result.isModified = false;
            return result;
        }
    }
    result.reuseExistingBranch = true;
    result.isModified = false;
    return result;
}
exports.shouldReuseExistingBranch = shouldReuseExistingBranch;
//# sourceMappingURL=reuse.js.map