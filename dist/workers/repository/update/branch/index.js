"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processBranch = void 0;
const tslib_1 = require("tslib");
const luxon_1 = require("luxon");
const global_1 = require("../../../../config/global");
const error_messages_1 = require("../../../../constants/error-messages");
const logger_1 = require("../../../../logger");
const post_update_1 = require("../../../../modules/manager/npm/post-update");
const platform_1 = require("../../../../modules/platform");
const comment_1 = require("../../../../modules/platform/comment");
const pr_body_1 = require("../../../../modules/platform/pr-body");
const types_1 = require("../../../../types");
const external_host_error_1 = require("../../../../types/errors/external-host-error");
const date_1 = require("../../../../util/date");
const emoji_1 = require("../../../../util/emoji");
const git_1 = require("../../../../util/git");
const merge_confidence_1 = require("../../../../util/merge-confidence");
const limits_1 = require("../../../global/limits");
const types_2 = require("../../../types");
const pr_1 = require("../pr");
const automerge_1 = require("../pr/automerge");
const body_1 = require("../pr/body");
const artifacts_1 = require("./artifacts");
const automerge_2 = require("./automerge");
const check_existing_1 = require("./check-existing");
const commit_1 = require("./commit");
const execute_post_upgrade_commands_1 = tslib_1.__importDefault(require("./execute-post-upgrade-commands"));
const get_updated_1 = require("./get-updated");
const handle_existing_1 = require("./handle-existing");
const reuse_1 = require("./reuse");
const schedule_1 = require("./schedule");
const status_checks_1 = require("./status-checks");
function rebaseCheck(config, branchPr) {
    const titleRebase = branchPr.title?.startsWith('rebase!');
    const labelRebase = branchPr.labels?.includes(config.rebaseLabel);
    const prRebaseChecked = !!branchPr.bodyStruct?.rebaseRequested;
    return titleRebase || labelRebase || prRebaseChecked;
}
async function deleteBranchSilently(branchName) {
    try {
        await (0, git_1.deleteBranch)(branchName);
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.debug({ branchName, err }, 'Branch auto-remove failed');
    }
}
async function processBranch(branchConfig) {
    let config = { ...branchConfig };
    logger_1.logger.trace({ config }, 'processBranch()');
    await (0, git_1.checkoutBranch)(config.baseBranch);
    let branchExists = (0, git_1.branchExists)(config.branchName);
    if (!branchExists && config.branchPrefix !== config.branchPrefixOld) {
        const branchName = config.branchName.replace(config.branchPrefix, config.branchPrefixOld);
        branchExists = (0, git_1.branchExists)(branchName);
        if (branchExists) {
            config.branchName = branchName;
            logger_1.logger.debug('Found existing branch with branchPrefixOld');
        }
    }
    let branchPr = await platform_1.platform.getBranchPr(config.branchName);
    logger_1.logger.debug(`branchExists=${branchExists}`);
    const dependencyDashboardCheck = config.dependencyDashboardChecks?.[config.branchName];
    logger_1.logger.debug(`dependencyDashboardCheck=${dependencyDashboardCheck}`);
    if (branchPr) {
        config.rebaseRequested = rebaseCheck(config, branchPr);
        logger_1.logger.debug(`PR rebase requested=${config.rebaseRequested}`);
    }
    const artifactErrorTopic = (0, emoji_1.emojify)(':warning: Artifact update problem');
    try {
        // Check if branch already existed
        const existingPr = branchPr ? undefined : await (0, check_existing_1.prAlreadyExisted)(config);
        if (existingPr && !dependencyDashboardCheck) {
            logger_1.logger.debug({ prTitle: config.prTitle }, 'Closed PR already exists. Skipping branch.');
            await (0, handle_existing_1.handlepr)(config, existingPr);
            return {
                branchExists: false,
                prNo: existingPr.number,
                result: types_2.BranchResult.AlreadyExisted,
            };
        }
        // istanbul ignore if
        if (!branchExists && config.dependencyDashboardApproval) {
            if (dependencyDashboardCheck) {
                logger_1.logger.debug(`Branch ${config.branchName} is approved for creation`);
            }
            else {
                logger_1.logger.debug(`Branch ${config.branchName} needs approval`);
                return {
                    branchExists,
                    prNo: branchPr?.number,
                    result: types_2.BranchResult.NeedsApproval,
                };
            }
        }
        if (!branchExists &&
            (0, limits_1.isLimitReached)(limits_1.Limit.Branches) &&
            !dependencyDashboardCheck &&
            !config.isVulnerabilityAlert) {
            logger_1.logger.debug('Reached branch limit - skipping branch creation');
            return {
                branchExists,
                prNo: branchPr?.number,
                result: types_2.BranchResult.BranchLimitReached,
            };
        }
        if ((0, limits_1.isLimitReached)(limits_1.Limit.Commits) &&
            !dependencyDashboardCheck &&
            !config.isVulnerabilityAlert) {
            logger_1.logger.debug('Reached commits limit - skipping branch');
            return {
                branchExists,
                prNo: branchPr?.number,
                result: types_2.BranchResult.CommitLimitReached,
            };
        }
        if (!branchExists &&
            branchConfig.pendingChecks &&
            !dependencyDashboardCheck) {
            return {
                branchExists: false,
                prNo: branchPr?.number,
                result: types_2.BranchResult.Pending,
            };
        }
        if (branchExists) {
            logger_1.logger.debug('Checking if PR has been edited');
            const branchIsModified = await (0, git_1.isBranchModified)(config.branchName);
            if (branchPr) {
                logger_1.logger.debug('Found existing branch PR');
                if (branchPr.state !== types_1.PrState.Open) {
                    logger_1.logger.debug('PR has been closed or merged since this run started - aborting');
                    throw new Error(error_messages_1.REPOSITORY_CHANGED);
                }
                if (branchIsModified ||
                    (branchPr.targetBranch &&
                        branchPr.targetBranch !== branchConfig.baseBranch)) {
                    logger_1.logger.debug({ prNo: branchPr.number }, 'PR has been edited');
                    if (dependencyDashboardCheck || config.rebaseRequested) {
                        logger_1.logger.debug('Manual rebase has been requested for PR');
                    }
                    else {
                        const newBody = await (0, body_1.getPrBody)(branchConfig, {
                            rebasingNotice: 'Renovate will not automatically rebase this PR, because other commits have been found.',
                        });
                        const newBodyHash = (0, pr_body_1.hashBody)(newBody);
                        if (newBodyHash !== branchPr.bodyStruct?.hash) {
                            logger_1.logger.debug('Updating existing PR to indicate that rebasing is not possible');
                            await platform_1.platform.updatePr({
                                number: branchPr.number,
                                prTitle: branchPr.title,
                                prBody: newBody,
                                platformOptions: (0, pr_1.getPlatformPrOptions)(config),
                            });
                        }
                        return {
                            branchExists,
                            prNo: branchPr.number,
                            result: types_2.BranchResult.PrEdited,
                        };
                    }
                }
            }
            else if (branchIsModified) {
                const oldPr = await platform_1.platform.findPr({
                    branchName: config.branchName,
                    state: types_1.PrState.NotOpen,
                });
                if (!oldPr) {
                    logger_1.logger.debug('Branch has been edited but found no PR - skipping');
                    return {
                        branchExists,
                        prNo: branchPr?.number,
                        result: types_2.BranchResult.PrEdited,
                    };
                }
                const branchSha = (0, git_1.getBranchCommit)(config.branchName);
                const oldPrSha = oldPr?.sha;
                if (!oldPrSha || oldPrSha === branchSha) {
                    logger_1.logger.debug({ oldPrNumber: oldPr.number, oldPrSha, branchSha }, 'Found old PR matching this branch - will override it');
                }
                else {
                    logger_1.logger.debug({ oldPrNumber: oldPr.number, oldPrSha, branchSha }, 'Found old PR but the SHA is different');
                    return {
                        branchExists,
                        prNo: branchPr?.number,
                        result: types_2.BranchResult.PrEdited,
                    };
                }
            }
        }
        // Check schedule
        config.isScheduledNow = (0, schedule_1.isScheduledNow)(config, 'schedule');
        if (!config.isScheduledNow && !dependencyDashboardCheck) {
            if (!branchExists) {
                logger_1.logger.debug('Skipping branch creation as not within schedule');
                return {
                    branchExists,
                    prNo: branchPr?.number,
                    result: types_2.BranchResult.NotScheduled,
                };
            }
            if (config.updateNotScheduled === false && !config.rebaseRequested) {
                logger_1.logger.debug('Skipping branch update as not within schedule');
                return {
                    branchExists,
                    prNo: branchPr?.number,
                    result: types_2.BranchResult.UpdateNotScheduled,
                };
            }
            // istanbul ignore if
            if (!branchPr) {
                logger_1.logger.debug('Skipping PR creation out of schedule');
                return {
                    branchExists,
                    prNo: branchPr?.number,
                    result: types_2.BranchResult.NotScheduled,
                };
            }
            logger_1.logger.debug('Branch + PR exists but is not scheduled -- will update if necessary');
        }
        if (config.upgrades.some((upgrade) => (upgrade.stabilityDays && upgrade.releaseTimestamp) ||
            (0, merge_confidence_1.isActiveConfidenceLevel)(upgrade.minimumConfidence))) {
            // Only set a stability status check if one or more of the updates contain
            // both a stabilityDays setting and a releaseTimestamp
            config.stabilityStatus = types_1.BranchStatus.green;
            // Default to 'success' but set 'pending' if any update is pending
            for (const upgrade of config.upgrades) {
                if (upgrade.stabilityDays && upgrade.releaseTimestamp) {
                    const daysElapsed = (0, date_1.getElapsedDays)(upgrade.releaseTimestamp);
                    if (daysElapsed < upgrade.stabilityDays) {
                        logger_1.logger.debug({
                            depName: upgrade.depName,
                            daysElapsed,
                            stabilityDays: upgrade.stabilityDays,
                        }, 'Update has not passed stability days');
                        config.stabilityStatus = types_1.BranchStatus.yellow;
                        continue;
                    }
                }
                const { datasource, depName, minimumConfidence, updateType, currentVersion, newVersion, } = upgrade;
                if ((0, merge_confidence_1.isActiveConfidenceLevel)(minimumConfidence)) {
                    const confidence = await (0, merge_confidence_1.getMergeConfidenceLevel)(datasource, depName, currentVersion, newVersion, updateType);
                    if ((0, merge_confidence_1.satisfiesConfidenceLevel)(confidence, minimumConfidence)) {
                        config.confidenceStatus = types_1.BranchStatus.green;
                    }
                    else {
                        logger_1.logger.debug({ depName, confidence, minimumConfidence }, 'Update does not meet minimum confidence scores');
                        config.confidenceStatus = types_1.BranchStatus.yellow;
                        continue;
                    }
                }
            }
            // Don't create a branch if we know it will be status ProcessBranchResult.Pending
            if (!dependencyDashboardCheck &&
                !branchExists &&
                config.stabilityStatus === types_1.BranchStatus.yellow &&
                ['not-pending', 'status-success'].includes(config.prCreation)) {
                logger_1.logger.debug('Skipping branch creation due to internal status checks not met');
                return {
                    branchExists,
                    prNo: branchPr?.number,
                    result: types_2.BranchResult.Pending,
                };
            }
        }
        const userRebaseRequested = dependencyDashboardCheck === 'rebase' ||
            config.dependencyDashboardRebaseAllOpen ||
            config.rebaseRequested;
        if (userRebaseRequested) {
            logger_1.logger.debug('Manual rebase requested via Dependency Dashboard');
            config.reuseExistingBranch = false;
        }
        else if (branchExists && config.rebaseWhen === 'never') {
            logger_1.logger.debug('rebaseWhen=never so skipping branch update check');
            return {
                branchExists,
                prNo: branchPr?.number,
                result: types_2.BranchResult.NoWork,
            };
        }
        else {
            config = { ...config, ...(await (0, reuse_1.shouldReuseExistingBranch)(config)) };
        }
        logger_1.logger.debug(`Using reuseExistingBranch: ${config.reuseExistingBranch}`);
        const res = await (0, get_updated_1.getUpdatedPackageFiles)(config);
        // istanbul ignore if
        if (res.artifactErrors && config.artifactErrors) {
            res.artifactErrors = config.artifactErrors.concat(res.artifactErrors);
        }
        config = { ...config, ...res };
        if (config.updatedPackageFiles?.length) {
            logger_1.logger.debug(`Updated ${config.updatedPackageFiles.length} package files`);
        }
        else {
            logger_1.logger.debug('No package files need updating');
        }
        const additionalFiles = await (0, post_update_1.getAdditionalFiles)(config, branchConfig.packageFiles);
        config.artifactErrors = (config.artifactErrors || []).concat(additionalFiles.artifactErrors);
        config.updatedArtifacts = (config.updatedArtifacts || []).concat(additionalFiles.updatedArtifacts);
        if (config.updatedArtifacts?.length) {
            logger_1.logger.debug({
                updatedArtifacts: config.updatedArtifacts.map((f) => f.type === 'deletion' ? `${f.path} (delete)` : f.path),
            }, `Updated ${config.updatedArtifacts.length} lock files`);
        }
        else {
            logger_1.logger.debug('No updated lock files in branch');
        }
        const postUpgradeCommandResults = await (0, execute_post_upgrade_commands_1.default)(config);
        if (postUpgradeCommandResults !== null) {
            const { updatedArtifacts, artifactErrors } = postUpgradeCommandResults;
            config.updatedArtifacts = updatedArtifacts;
            config.artifactErrors = artifactErrors;
        }
        (0, logger_1.removeMeta)(['dep']);
        if (config.artifactErrors?.length) {
            if (config.releaseTimestamp) {
                logger_1.logger.debug(`Branch timestamp: ` + config.releaseTimestamp);
                const releaseTimestamp = luxon_1.DateTime.fromISO(config.releaseTimestamp);
                if (releaseTimestamp.plus({ hours: 2 }) < luxon_1.DateTime.local()) {
                    logger_1.logger.debug('PR is older than 2 hours, raise PR with lock file errors');
                }
                else if (branchExists) {
                    logger_1.logger.debug('PR is less than 2 hours old but branchExists so updating anyway');
                }
                else {
                    logger_1.logger.debug('PR is less than 2 hours old - raise error instead of PR');
                    throw new Error(error_messages_1.MANAGER_LOCKFILE_ERROR);
                }
            }
            else {
                logger_1.logger.debug('PR has no releaseTimestamp');
            }
        }
        else if (config.updatedArtifacts?.length && branchPr) {
            // If there are artifacts, no errors, and an existing PR then ensure any artifacts error comment is removed
            // istanbul ignore if
            if (global_1.GlobalConfig.get('dryRun')) {
                logger_1.logger.info(`DRY-RUN: Would ensure comment removal in PR #${branchPr.number}`);
            }
            else {
                // Remove artifacts error comment only if this run has successfully updated artifacts
                await (0, comment_1.ensureCommentRemoval)({
                    type: 'by-topic',
                    number: branchPr.number,
                    topic: artifactErrorTopic,
                });
            }
        }
        const forcedManually = userRebaseRequested || !branchExists;
        config.isConflicted ?? (config.isConflicted = branchExists &&
            (await (0, git_1.isBranchConflicted)(config.baseBranch, config.branchName)));
        config.forceCommit = forcedManually || config.isConflicted;
        config.stopUpdating = branchPr?.labels?.includes(config.stopUpdatingLabel);
        const prRebaseChecked = !!branchPr?.bodyStruct?.rebaseRequested;
        if (branchExists && dependencyDashboardCheck && config.stopUpdating) {
            if (!prRebaseChecked) {
                logger_1.logger.info('Branch updating is skipped because stopUpdatingLabel is present in config');
                return {
                    branchExists: true,
                    prNo: branchPr?.number,
                    result: types_2.BranchResult.NoWork,
                };
            }
        }
        const commitSha = await (0, commit_1.commitFilesToBranch)(config);
        // istanbul ignore if
        if (branchPr && platform_1.platform.refreshPr) {
            await platform_1.platform.refreshPr(branchPr.number);
        }
        if (!commitSha && !branchExists) {
            return {
                branchExists,
                prNo: branchPr?.number,
                result: types_2.BranchResult.NoWork,
            };
        }
        if (commitSha) {
            const action = branchExists ? 'updated' : 'created';
            logger_1.logger.info({ commitSha }, `Branch ${action}`);
        }
        // Set branch statuses
        await (0, artifacts_1.setArtifactErrorStatus)(config);
        await (0, status_checks_1.setStability)(config);
        await (0, status_checks_1.setConfidence)(config);
        // break if we pushed a new commit because status check are pretty sure pending but maybe not reported yet
        // but do not break when there are artifact errors
        if (!config.artifactErrors?.length &&
            !userRebaseRequested &&
            commitSha &&
            config.prCreation !== 'immediate') {
            logger_1.logger.debug({ commitSha }, `Branch status pending`);
            return {
                branchExists: true,
                prNo: branchPr?.number,
                result: types_2.BranchResult.Pending,
            };
        }
        // Try to automerge branch and finish if successful, but only if branch already existed before this run
        if (branchExists || config.ignoreTests) {
            const mergeStatus = await (0, automerge_2.tryBranchAutomerge)(config);
            logger_1.logger.debug(`mergeStatus=${mergeStatus}`);
            if (mergeStatus === 'automerged') {
                if (global_1.GlobalConfig.get('dryRun')) {
                    logger_1.logger.info('DRY-RUN: Would delete branch' + config.branchName);
                }
                else {
                    await deleteBranchSilently(config.branchName);
                }
                logger_1.logger.debug('Branch is automerged - returning');
                return { branchExists: false, result: types_2.BranchResult.Automerged };
            }
            if (mergeStatus === 'off schedule') {
                logger_1.logger.debug('Branch cannot automerge now because automergeSchedule is off schedule - skipping');
                return { branchExists, result: types_2.BranchResult.NotScheduled };
            }
            if (mergeStatus === 'stale' &&
                ['conflicted', 'never'].includes(config.rebaseWhen)) {
                logger_1.logger.warn('Branch cannot automerge because it is stale and rebaseWhen setting disallows rebasing - raising a PR instead');
                config.forcePr = true;
                config.branchAutomergeFailureMessage = mergeStatus;
            }
            if (mergeStatus === 'automerge aborted - PR exists' ||
                mergeStatus === 'branch status error' ||
                mergeStatus === 'failed') {
                logger_1.logger.debug({ mergeStatus }, 'Branch automerge not possible');
                config.forcePr = true;
                config.branchAutomergeFailureMessage = mergeStatus;
            }
        }
    }
    catch (err) /* istanbul ignore next */ {
        if (err.statusCode === 404) {
            logger_1.logger.debug({ err }, 'Received a 404 error - aborting run');
            throw new Error(error_messages_1.REPOSITORY_CHANGED);
        }
        if (err.message === error_messages_1.PLATFORM_RATE_LIMIT_EXCEEDED) {
            logger_1.logger.debug('Passing rate-limit-exceeded error up');
            throw err;
        }
        if (err.message === error_messages_1.REPOSITORY_CHANGED) {
            logger_1.logger.debug('Passing repository-changed error up');
            throw err;
        }
        if (err.message?.startsWith('remote: Invalid username or password')) {
            logger_1.logger.debug('Throwing bad credentials');
            throw new Error(error_messages_1.PLATFORM_BAD_CREDENTIALS);
        }
        if (err.message?.startsWith('ssh_exchange_identification: Connection closed by remote host')) {
            logger_1.logger.debug('Throwing bad credentials');
            throw new Error(error_messages_1.PLATFORM_BAD_CREDENTIALS);
        }
        if (err.message === error_messages_1.PLATFORM_BAD_CREDENTIALS) {
            logger_1.logger.debug('Passing bad-credentials error up');
            throw err;
        }
        if (err.message === error_messages_1.PLATFORM_INTEGRATION_UNAUTHORIZED) {
            logger_1.logger.debug('Passing integration-unauthorized error up');
            throw err;
        }
        if (err.message === error_messages_1.MANAGER_LOCKFILE_ERROR) {
            logger_1.logger.debug('Passing lockfile-error up');
            throw err;
        }
        if (err.message?.includes('space left on device')) {
            throw new Error(error_messages_1.SYSTEM_INSUFFICIENT_DISK_SPACE);
        }
        if (err.message === error_messages_1.SYSTEM_INSUFFICIENT_DISK_SPACE) {
            logger_1.logger.debug('Passing disk-space error up');
            throw err;
        }
        if (err.message.startsWith('Resource not accessible by integration')) {
            logger_1.logger.debug('Passing 403 error up');
            throw err;
        }
        if (err.message === error_messages_1.WORKER_FILE_UPDATE_FAILED) {
            logger_1.logger.warn('Error updating branch: update failure');
        }
        else if (err.message.startsWith('bundler-')) {
            // we have already warned inside the bundler artifacts error handling, so just return
            return {
                branchExists: true,
                prNo: branchPr?.number,
                result: types_2.BranchResult.Error,
            };
        }
        else if (err.messagee &&
            err.message.includes('fatal: Authentication failed')) {
            throw new Error(error_messages_1.PLATFORM_AUTHENTICATION_ERROR);
        }
        else if (err.message?.includes('fatal: bad revision')) {
            logger_1.logger.debug({ err }, 'Aborting job due to bad revision error');
            throw new Error(error_messages_1.REPOSITORY_CHANGED);
        }
        else if (err.message === error_messages_1.CONFIG_VALIDATION) {
            logger_1.logger.debug('Passing config validation error up');
            throw err;
        }
        else if (err.message === error_messages_1.TEMPORARY_ERROR) {
            logger_1.logger.debug('Passing TEMPORARY_ERROR error up');
            throw err;
        }
        else if (!(err instanceof external_host_error_1.ExternalHostError)) {
            logger_1.logger.warn({ err }, `Error updating branch`);
        }
        // Don't throw here - we don't want to stop the other renovations
        return { branchExists, prNo: branchPr?.number, result: types_2.BranchResult.Error };
    }
    try {
        logger_1.logger.debug('Ensuring PR');
        logger_1.logger.debug(`There are ${config.errors.length} errors and ${config.warnings.length} warnings`);
        const ensurePrResult = await (0, pr_1.ensurePr)(config);
        if (ensurePrResult.type === 'without-pr') {
            const { prBlockedBy } = ensurePrResult;
            branchPr = null;
            if (prBlockedBy === 'RateLimited' && !config.isVulnerabilityAlert) {
                logger_1.logger.debug('Reached PR limit - skipping PR creation');
                return {
                    branchExists,
                    prBlockedBy,
                    result: types_2.BranchResult.PrLimitReached,
                };
            }
            // TODO: ensurePr should check for automerge itself (#9719)
            if (prBlockedBy === 'NeedsApproval') {
                return {
                    branchExists,
                    prBlockedBy,
                    result: types_2.BranchResult.NeedsPrApproval,
                };
            }
            if (prBlockedBy === 'AwaitingTests') {
                return { branchExists, prBlockedBy, result: types_2.BranchResult.Pending };
            }
            if (prBlockedBy === 'BranchAutomerge') {
                return {
                    branchExists,
                    prBlockedBy,
                    result: types_2.BranchResult.Done,
                };
            }
            if (prBlockedBy === 'Error') {
                return { branchExists, prBlockedBy, result: types_2.BranchResult.Error };
            }
            logger_1.logger.warn({ prBlockedBy }, 'Unknown PrBlockedBy result');
            return { branchExists, prBlockedBy, result: types_2.BranchResult.Error };
        }
        if (ensurePrResult.type === 'with-pr') {
            const { pr } = ensurePrResult;
            branchPr = pr;
            if (config.artifactErrors?.length) {
                logger_1.logger.warn({ artifactErrors: config.artifactErrors }, 'artifactErrors');
                let content = `Renovate failed to update `;
                content +=
                    config.artifactErrors.length > 1 ? 'artifacts' : 'an artifact';
                content +=
                    ' related to this branch. You probably do not want to merge this PR as-is.';
                content += (0, emoji_1.emojify)(`\n\n:recycle: Renovate will retry this branch, including artifacts, only when one of the following happens:\n\n`);
                content +=
                    ' - any of the package files in this branch needs updating, or \n';
                content += ' - the branch becomes conflicted, or\n';
                content +=
                    ' - you click the rebase/retry checkbox if found above, or\n';
                content +=
                    ' - you rename this PR\'s title to start with "rebase!" to trigger it manually';
                content += '\n\nThe artifact failure details are included below:\n\n';
                config.artifactErrors.forEach((error) => {
                    content += `##### File name: ${error.lockFile}\n\n`;
                    content += `\`\`\`\n${error.stderr}\n\`\`\`\n\n`;
                });
                content = platform_1.platform.massageMarkdown(content);
                if (!(config.suppressNotifications.includes('artifactErrors') ||
                    config.suppressNotifications.includes('lockFileErrors'))) {
                    if (global_1.GlobalConfig.get('dryRun')) {
                        logger_1.logger.info(`DRY-RUN: Would ensure lock file error comment in PR #${pr.number}`);
                    }
                    else {
                        await (0, comment_1.ensureComment)({
                            number: pr.number,
                            topic: artifactErrorTopic,
                            content,
                        });
                    }
                }
            }
            else if (config.automerge) {
                logger_1.logger.debug('PR is configured for automerge');
                const prAutomergeResult = await (0, automerge_1.checkAutoMerge)(pr, config);
                if (prAutomergeResult?.automerged) {
                    return { branchExists, result: types_2.BranchResult.Automerged };
                }
            }
            else {
                logger_1.logger.debug('PR is not configured for automerge');
            }
        }
    }
    catch (err) /* istanbul ignore next */ {
        if (err instanceof external_host_error_1.ExternalHostError ||
            [error_messages_1.PLATFORM_RATE_LIMIT_EXCEEDED, error_messages_1.REPOSITORY_CHANGED].includes(err.message)) {
            logger_1.logger.debug('Passing PR error up');
            throw err;
        }
        // Otherwise don't throw here - we don't want to stop the other renovations
        logger_1.logger.error({ err }, `Error ensuring PR: ${String(err.message)}`);
    }
    if (!branchExists) {
        return {
            branchExists: true,
            prNo: branchPr?.number,
            result: types_2.BranchResult.PrCreated,
        };
    }
    return { branchExists, prNo: branchPr?.number, result: types_2.BranchResult.Done };
}
exports.processBranch = processBranch;
//# sourceMappingURL=index.js.map