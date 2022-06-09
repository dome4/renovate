"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensurePr = exports.getPlatformPrOptions = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const global_1 = require("../../../../config/global");
const error_messages_1 = require("../../../../constants/error-messages");
const logger_1 = require("../../../../logger");
const platform_1 = require("../../../../modules/platform");
const comment_1 = require("../../../../modules/platform/comment");
const pr_body_1 = require("../../../../modules/platform/pr-body");
const types_1 = require("../../../../types");
const external_host_error_1 = require("../../../../types/errors/external-host-error");
const emoji_1 = require("../../../../util/emoji");
const git_1 = require("../../../../util/git");
const memoize_1 = require("../../../../util/memoize");
const limits_1 = require("../../../global/limits");
const status_checks_1 = require("../branch/status-checks");
const body_1 = require("./body");
const types_2 = require("./changelog/types");
const labels_1 = require("./labels");
const participants_1 = require("./participants");
function getPlatformPrOptions(config) {
    const usePlatformAutomerge = Boolean(config.automerge &&
        (config.automergeType === 'pr' || config.automergeType === 'branch') &&
        config.platformAutomerge);
    return {
        azureAutoApprove: config.azureAutoApprove,
        azureWorkItemId: config.azureWorkItemId,
        bbUseDefaultReviewers: config.bbUseDefaultReviewers,
        gitLabIgnoreApprovals: config.gitLabIgnoreApprovals,
        usePlatformAutomerge,
    };
}
exports.getPlatformPrOptions = getPlatformPrOptions;
// Ensures that PR exists with matching title/body
async function ensurePr(prConfig) {
    const getBranchStatus = (0, memoize_1.memoize)(() => (0, status_checks_1.resolveBranchStatus)(branchName, ignoreTests));
    const config = { ...prConfig };
    logger_1.logger.trace({ config }, 'ensurePr');
    // If there is a group, it will use the config of the first upgrade in the array
    const { branchName, ignoreTests, prTitle = '', upgrades } = config;
    const dependencyDashboardCheck = config.dependencyDashboardChecks?.[config.branchName];
    // Check if existing PR exists
    const existingPr = await platform_1.platform.getBranchPr(branchName);
    if (existingPr) {
        logger_1.logger.debug('Found existing PR');
    }
    config.upgrades = [];
    if (config.artifactErrors?.length) {
        logger_1.logger.debug('Forcing PR because of artifact errors');
        config.forcePr = true;
    }
    // Only create a PR if a branch automerge has failed
    if (config.automerge === true &&
        config.automergeType?.startsWith('branch') &&
        !config.forcePr) {
        logger_1.logger.debug(`Branch automerge is enabled`);
        if (config.stabilityStatus !== types_1.BranchStatus.yellow &&
            (await getBranchStatus()) === types_1.BranchStatus.yellow &&
            is_1.default.number(config.prNotPendingHours)) {
            logger_1.logger.debug('Checking how long this branch has been pending');
            const lastCommitTime = await (0, git_1.getBranchLastCommitTime)(branchName);
            const currentTime = new Date();
            const millisecondsPerHour = 1000 * 60 * 60;
            const elapsedHours = Math.round((currentTime.getTime() - lastCommitTime.getTime()) / millisecondsPerHour);
            if (elapsedHours >= config.prNotPendingHours) {
                logger_1.logger.debug('Branch exceeds prNotPending hours - forcing PR creation');
                config.forcePr = true;
            }
        }
        if (config.forcePr || (await getBranchStatus()) === types_1.BranchStatus.red) {
            logger_1.logger.debug(`Branch tests failed, so will create PR`);
        }
        else {
            // Branch should be automerged, so we don't want to create a PR
            return { type: 'without-pr', prBlockedBy: 'BranchAutomerge' };
        }
    }
    if (config.prCreation === 'status-success') {
        logger_1.logger.debug('Checking branch combined status');
        if ((await getBranchStatus()) !== types_1.BranchStatus.green) {
            logger_1.logger.debug(`Branch status isn't green - not creating PR`);
            return { type: 'without-pr', prBlockedBy: 'AwaitingTests' };
        }
        logger_1.logger.debug('Branch status success');
    }
    else if (config.prCreation === 'approval' &&
        !existingPr &&
        dependencyDashboardCheck !== 'approvePr') {
        return { type: 'without-pr', prBlockedBy: 'NeedsApproval' };
    }
    else if (config.prCreation === 'not-pending' &&
        !existingPr &&
        !config.forcePr) {
        logger_1.logger.debug('Checking branch combined status');
        if ((await getBranchStatus()) === types_1.BranchStatus.yellow) {
            logger_1.logger.debug(`Branch status is yellow - checking timeout`);
            const lastCommitTime = await (0, git_1.getBranchLastCommitTime)(branchName);
            const currentTime = new Date();
            const millisecondsPerHour = 1000 * 60 * 60;
            const elapsedHours = Math.round((currentTime.getTime() - lastCommitTime.getTime()) / millisecondsPerHour);
            if (!dependencyDashboardCheck &&
                ((config.stabilityStatus &&
                    config.stabilityStatus !== types_1.BranchStatus.yellow) ||
                    (is_1.default.number(config.prNotPendingHours) &&
                        elapsedHours < config.prNotPendingHours))) {
                logger_1.logger.debug(`Branch is ${elapsedHours} hours old - skipping PR creation`);
                return {
                    type: 'without-pr',
                    prBlockedBy: 'AwaitingTests',
                };
            }
            const prNotPendingHours = String(config.prNotPendingHours);
            logger_1.logger.debug(`prNotPendingHours=${prNotPendingHours} threshold hit - creating PR`);
        }
        logger_1.logger.debug('Branch status success');
    }
    const processedUpgrades = [];
    const commitRepos = [];
    function getRepoNameWithSourceDirectory(upgrade) {
        return `${upgrade.repoName}${upgrade.sourceDirectory ? `:${upgrade.sourceDirectory}` : ''}`;
    }
    // Get changelog and then generate template strings
    for (const upgrade of upgrades) {
        const upgradeKey = `${upgrade.depType}-${upgrade.depName}-${upgrade.manager}-${upgrade.currentVersion || upgrade.currentValue}-${upgrade.newVersion}`;
        if (processedUpgrades.includes(upgradeKey)) {
            continue;
        }
        processedUpgrades.push(upgradeKey);
        const logJSON = upgrade.logJSON;
        if (logJSON) {
            if (typeof logJSON.error === 'undefined') {
                if (logJSON.project) {
                    upgrade.repoName = logJSON.project.repository;
                }
                upgrade.hasReleaseNotes = false;
                upgrade.releases = [];
                if (logJSON.hasReleaseNotes &&
                    upgrade.repoName &&
                    !commitRepos.includes(getRepoNameWithSourceDirectory(upgrade))) {
                    commitRepos.push(getRepoNameWithSourceDirectory(upgrade));
                    upgrade.hasReleaseNotes = logJSON.hasReleaseNotes;
                    if (logJSON.versions) {
                        for (const version of logJSON.versions) {
                            const release = { ...version };
                            upgrade.releases.push(release);
                        }
                    }
                }
            }
            else if (logJSON.error === types_2.ChangeLogError.MissingGithubToken) {
                upgrade.prBodyNotes ?? (upgrade.prBodyNotes = []);
                upgrade.prBodyNotes = [
                    ...upgrade.prBodyNotes,
                    [
                        '\n',
                        ':warning: Release Notes retrieval for this PR were skipped because no github.com credentials were available.',
                        'If you are self-hosted, please see [this instruction](https://github.com/renovatebot/renovate/blob/master/docs/usage/examples/self-hosting.md#githubcom-token-for-release-notes).',
                        '\n',
                    ].join('\n'),
                ];
            }
        }
        config.upgrades.push(upgrade);
    }
    config.hasReleaseNotes = config.upgrades.some((upg) => upg.hasReleaseNotes);
    const releaseNotesSources = [];
    for (const upgrade of config.upgrades) {
        let notesSourceUrl = upgrade.releases?.[0]?.releaseNotes?.notesSourceUrl;
        if (!notesSourceUrl) {
            notesSourceUrl = `${upgrade.sourceUrl}${upgrade.sourceDirectory ? `:${upgrade.sourceDirectory}` : ''}`;
        }
        if (upgrade.hasReleaseNotes && notesSourceUrl) {
            if (releaseNotesSources.includes(notesSourceUrl)) {
                logger_1.logger.debug({ depName: upgrade.depName }, 'Removing duplicate release notes');
                upgrade.hasReleaseNotes = false;
            }
            else {
                releaseNotesSources.push(notesSourceUrl);
            }
        }
    }
    const prBody = await (0, body_1.getPrBody)(config);
    try {
        if (existingPr) {
            logger_1.logger.debug('Processing existing PR');
            if (!existingPr.hasAssignees &&
                !existingPr.hasReviewers &&
                config.automerge &&
                !config.assignAutomerge &&
                (await getBranchStatus()) === types_1.BranchStatus.red) {
                logger_1.logger.debug(`Setting assignees and reviewers as status checks failed`);
                await (0, participants_1.addParticipants)(config, existingPr);
            }
            // Check if existing PR needs updating
            const existingPrTitle = (0, emoji_1.stripEmojis)(existingPr.title);
            const existingPrBodyHash = existingPr.bodyStruct?.hash;
            const newPrTitle = (0, emoji_1.stripEmojis)(prTitle);
            const newPrBodyHash = (0, pr_body_1.hashBody)(prBody);
            if (existingPrTitle === newPrTitle &&
                existingPrBodyHash === newPrBodyHash) {
                logger_1.logger.debug(`${existingPr.displayNumber} does not need updating`);
                return { type: 'with-pr', pr: existingPr };
            }
            // PR must need updating
            if (existingPrTitle !== newPrTitle) {
                logger_1.logger.debug({
                    branchName,
                    oldPrTitle: existingPr.title,
                    newPrTitle: prTitle,
                }, 'PR title changed');
            }
            else if (!config.committedFiles && !config.rebaseRequested) {
                logger_1.logger.debug({
                    prTitle,
                }, 'PR body changed');
            }
            if (global_1.GlobalConfig.get('dryRun')) {
                logger_1.logger.info(`DRY-RUN: Would update PR #${existingPr.number}`);
            }
            else {
                await platform_1.platform.updatePr({
                    number: existingPr.number,
                    prTitle,
                    prBody,
                    platformOptions: getPlatformPrOptions(config),
                });
                logger_1.logger.info({ pr: existingPr.number, prTitle }, `PR updated`);
            }
            return { type: 'with-pr', pr: existingPr };
        }
        logger_1.logger.debug({ branch: branchName, prTitle }, `Creating PR`);
        if (config.updateType === 'rollback') {
            logger_1.logger.info('Creating Rollback PR');
        }
        let pr;
        if (global_1.GlobalConfig.get('dryRun')) {
            logger_1.logger.info('DRY-RUN: Would create PR: ' + prTitle);
            pr = { number: 0, displayNumber: 'Dry run PR' };
        }
        else {
            try {
                if (!dependencyDashboardCheck &&
                    (0, limits_1.isLimitReached)(limits_1.Limit.PullRequests) &&
                    !config.isVulnerabilityAlert) {
                    logger_1.logger.debug('Skipping PR - limit reached');
                    return { type: 'without-pr', prBlockedBy: 'RateLimited' };
                }
                pr = await platform_1.platform.createPr({
                    sourceBranch: branchName,
                    targetBranch: config.baseBranch ?? '',
                    prTitle,
                    prBody,
                    labels: (0, labels_1.prepareLabels)(config),
                    platformOptions: getPlatformPrOptions(config),
                    draftPR: config.draftPR,
                });
                (0, limits_1.incLimitedValue)(limits_1.Limit.PullRequests);
                logger_1.logger.info({ pr: pr?.number, prTitle }, 'PR created');
            }
            catch (err) {
                logger_1.logger.debug({ err }, 'Pull request creation error');
                if (err.body?.message === 'Validation failed' &&
                    err.body.errors?.length &&
                    err.body.errors.some((error) => error.message?.startsWith('A pull request already exists'))) {
                    logger_1.logger.warn('A pull requests already exists');
                    return { type: 'without-pr', prBlockedBy: 'Error' };
                }
                if (err.statusCode === 502) {
                    logger_1.logger.warn({ branch: branchName }, 'Deleting branch due to server error');
                    await (0, git_1.deleteBranch)(branchName);
                }
                return { type: 'without-pr', prBlockedBy: 'Error' };
            }
        }
        if (pr &&
            config.branchAutomergeFailureMessage &&
            !config.suppressNotifications?.includes('branchAutomergeFailure')) {
            const topic = 'Branch automerge failure';
            let content = 'This PR was configured for branch automerge, however this is not possible so it has been raised as a PR instead.';
            if (config.branchAutomergeFailureMessage === 'branch status error') {
                content += '\n___\n * Branch has one or more failed status checks';
            }
            content = platform_1.platform.massageMarkdown(content);
            logger_1.logger.debug('Adding branch automerge failure message to PR');
            if (global_1.GlobalConfig.get('dryRun')) {
                logger_1.logger.info(`DRY-RUN: Would add comment to PR #${pr.number}`);
            }
            else {
                await (0, comment_1.ensureComment)({
                    number: pr.number,
                    topic,
                    content,
                });
            }
        }
        // Skip assign and review if automerging PR
        if (pr) {
            if (config.automerge &&
                !config.assignAutomerge &&
                (await getBranchStatus()) !== types_1.BranchStatus.red) {
                logger_1.logger.debug(`Skipping assignees and reviewers as automerge=${config.automerge}`);
            }
            else {
                await (0, participants_1.addParticipants)(config, pr);
            }
            logger_1.logger.debug(`Created ${pr.displayNumber}`);
            return { type: 'with-pr', pr };
        }
    }
    catch (err) {
        if (err instanceof external_host_error_1.ExternalHostError ||
            err.message === error_messages_1.REPOSITORY_CHANGED ||
            err.message === error_messages_1.PLATFORM_RATE_LIMIT_EXCEEDED ||
            err.message === error_messages_1.PLATFORM_INTEGRATION_UNAUTHORIZED) {
            logger_1.logger.debug('Passing error up');
            throw err;
        }
        logger_1.logger.error({ err }, 'Failed to ensure PR: ' + prTitle);
    }
    if (existingPr) {
        return { type: 'with-pr', pr: existingPr };
    }
    return { type: 'without-pr', prBlockedBy: 'Error' };
}
exports.ensurePr = ensurePr;
//# sourceMappingURL=index.js.map