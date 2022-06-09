"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commitFiles = exports.getVulnerabilityAlerts = exports.massageMarkdown = exports.mergePr = exports.updatePr = exports.createPr = exports.ensureCommentRemoval = exports.ensureComment = exports.deleteLabel = exports.addReviewers = exports.addAssignees = exports.ensureIssueClosing = exports.ensureIssue = exports.findIssue = exports.getIssue = exports.getIssueList = exports.setBranchStatus = exports.getBranchStatusCheck = exports.getBranchStatus = exports.getBranchPr = exports.findPr = exports.getPrList = exports.getPr = exports.getRepoForceRebase = exports.initRepo = exports.getJsonFile = exports.getRawFile = exports.getRepos = exports.initPlatform = exports.detectGhe = exports.resetConfigs = void 0;
const tslib_1 = require("tslib");
const url_1 = tslib_1.__importDefault(require("url"));
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const delay_1 = tslib_1.__importDefault(require("delay"));
const json5_1 = tslib_1.__importDefault(require("json5"));
const luxon_1 = require("luxon");
const semver_1 = tslib_1.__importDefault(require("semver"));
const global_1 = require("../../../config/global");
const constants_1 = require("../../../constants");
const error_messages_1 = require("../../../constants/error-messages");
const logger_1 = require("../../../logger");
const types_1 = require("../../../types");
const external_host_error_1 = require("../../../types/errors/external-host-error");
const git = tslib_1.__importStar(require("../../../util/git"));
const git_1 = require("../../../util/git");
const hostRules = tslib_1.__importStar(require("../../../util/host-rules"));
const githubHttp = tslib_1.__importStar(require("../../../util/http/github"));
const regex_1 = require("../../../util/regex");
const sanitize_1 = require("../../../util/sanitize");
const string_1 = require("../../../util/string");
const url_2 = require("../../../util/url");
const pr_body_1 = require("../utils/pr-body");
const common_1 = require("./common");
const graphql_1 = require("./graphql");
const massage_markdown_links_1 = require("./massage-markdown-links");
const pr_1 = require("./pr");
const user_1 = require("./user");
const githubApi = new githubHttp.GithubHttp();
let config;
let platformConfig;
function resetConfigs() {
    config = {};
    platformConfig = {
        hostType: constants_1.PlatformId.Github,
        endpoint: 'https://api.github.com/',
    };
}
exports.resetConfigs = resetConfigs;
resetConfigs();
function escapeHash(input) {
    return input ? input.replace((0, regex_1.regEx)(/#/g), '%23') : input;
}
async function detectGhe(token) {
    platformConfig.isGhe =
        url_1.default.parse(platformConfig.endpoint).host !== 'api.github.com';
    if (platformConfig.isGhe) {
        const gheHeaderKey = 'x-github-enterprise-version';
        const gheQueryRes = await githubApi.headJson('/', { token });
        const gheHeaders = gheQueryRes?.headers || {};
        const [, gheVersion] = Object.entries(gheHeaders).find(([k]) => k.toLowerCase() === gheHeaderKey) ?? [];
        platformConfig.gheVersion = semver_1.default.valid(gheVersion) ?? null;
        logger_1.logger.debug(`Detected GitHub Enterprise Server, version: ${platformConfig.gheVersion}`);
    }
}
exports.detectGhe = detectGhe;
async function initPlatform({ endpoint, token, username, gitAuthor, }) {
    if (!token) {
        throw new Error('Init: You must configure a GitHub personal access token');
    }
    platformConfig.isGHApp = token.startsWith('x-access-token:');
    if (endpoint) {
        platformConfig.endpoint = (0, url_2.ensureTrailingSlash)(endpoint);
        githubHttp.setBaseUrl(platformConfig.endpoint);
    }
    else {
        logger_1.logger.debug('Using default github endpoint: ' + platformConfig.endpoint);
    }
    await detectGhe(token);
    let renovateUsername;
    if (username) {
        renovateUsername = username;
    }
    else {
        platformConfig.userDetails ?? (platformConfig.userDetails = await (0, user_1.getUserDetails)(platformConfig.endpoint, token));
        renovateUsername = platformConfig.userDetails.username;
    }
    let discoveredGitAuthor;
    if (!gitAuthor) {
        platformConfig.userDetails ?? (platformConfig.userDetails = await (0, user_1.getUserDetails)(platformConfig.endpoint, token));
        platformConfig.userEmail ?? (platformConfig.userEmail = await (0, user_1.getUserEmail)(platformConfig.endpoint, token));
        if (platformConfig.userEmail) {
            discoveredGitAuthor = `${platformConfig.userDetails.name} <${platformConfig.userEmail}>`;
        }
    }
    logger_1.logger.debug({ platformConfig, renovateUsername }, 'Platform config');
    const platformResult = {
        endpoint: platformConfig.endpoint,
        gitAuthor: gitAuthor || discoveredGitAuthor,
        renovateUsername,
    };
    return platformResult;
}
exports.initPlatform = initPlatform;
// Get all repositories that the user has access to
async function getRepos() {
    logger_1.logger.debug('Autodiscovering GitHub repositories');
    try {
        if (platformConfig.isGHApp) {
            const res = await githubApi.getJson(`installation/repositories?per_page=100`, {
                paginationField: 'repositories',
                paginate: 'all',
            });
            return res.body.repositories
                .filter(is_1.default.nonEmptyObject)
                .map((repo) => repo.full_name);
        }
        else {
            const res = await githubApi.getJson(`user/repos?per_page=100`, { paginate: 'all' });
            return res.body.filter(is_1.default.nonEmptyObject).map((repo) => repo.full_name);
        }
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.error({ err }, `GitHub getRepos error`);
        throw err;
    }
}
exports.getRepos = getRepos;
async function getBranchProtection(branchName) {
    // istanbul ignore if
    if (config.parentRepo) {
        return {};
    }
    const res = await githubApi.getJson(`repos/${config.repository}/branches/${escapeHash(branchName)}/protection`);
    return res.body;
}
async function getRawFile(fileName, repoName, branchOrTag) {
    const repo = repoName ?? config.repository;
    let url = `repos/${repo}/contents/${fileName}`;
    if (branchOrTag) {
        url += `?ref=` + branchOrTag;
    }
    const res = await githubApi.getJson(url);
    const buf = res.body.content;
    const str = (0, string_1.fromBase64)(buf);
    return str;
}
exports.getRawFile = getRawFile;
async function getJsonFile(fileName, repoName, branchOrTag) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const raw = (await getRawFile(fileName, repoName, branchOrTag));
    return json5_1.default.parse(raw);
}
exports.getJsonFile = getJsonFile;
// Initialize GitHub by getting base branch and SHA
async function initRepo({ endpoint, repository, forkMode, forkToken, renovateUsername, cloneSubmodules, ignorePrAuthor, }) {
    logger_1.logger.debug(`initRepo("${repository}")`);
    // config is used by the platform api itself, not necessary for the app layer to know
    config = {
        repository,
        cloneSubmodules,
        ignorePrAuthor,
    };
    // istanbul ignore if
    if (endpoint) {
        // Necessary for Renovate Pro - do not remove
        logger_1.logger.debug({ endpoint }, 'Overriding default GitHub endpoint');
        platformConfig.endpoint = endpoint;
        githubHttp.setBaseUrl(endpoint);
    }
    const opts = hostRules.find({
        hostType: constants_1.PlatformId.Github,
        url: platformConfig.endpoint,
    });
    config.renovateUsername = renovateUsername;
    [config.repositoryOwner, config.repositoryName] = repository.split('/');
    let repo;
    try {
        let infoQuery = graphql_1.repoInfoQuery;
        if (platformConfig.isGhe) {
            infoQuery = infoQuery.replace(/\n\s*autoMergeAllowed\s*\n/, '\n');
            infoQuery = infoQuery.replace(/\n\s*hasIssuesEnabled\s*\n/, '\n');
        }
        const res = await githubApi.requestGraphql(infoQuery, {
            variables: {
                owner: config.repositoryOwner,
                name: config.repositoryName,
            },
        });
        repo = res?.data?.repository;
        // istanbul ignore if
        if (!repo) {
            throw new Error(error_messages_1.REPOSITORY_NOT_FOUND);
        }
        // istanbul ignore if
        if (!repo.defaultBranchRef?.name) {
            throw new Error(error_messages_1.REPOSITORY_EMPTY);
        }
        if (repo.nameWithOwner &&
            repo.nameWithOwner.toUpperCase() !== repository.toUpperCase()) {
            logger_1.logger.debug({ repository, this_repository: repo.nameWithOwner }, 'Repository has been renamed');
            throw new Error(error_messages_1.REPOSITORY_RENAMED);
        }
        if (repo.isArchived) {
            logger_1.logger.debug('Repository is archived - throwing error to abort renovation');
            throw new Error(error_messages_1.REPOSITORY_ARCHIVED);
        }
        // Use default branch as PR target unless later overridden.
        config.defaultBranch = repo.defaultBranchRef.name;
        // Base branch may be configured but defaultBranch is always fixed
        logger_1.logger.debug(`${repository} default branch = ${config.defaultBranch}`);
        // GitHub allows administrators to block certain types of merge, so we need to check it
        if (repo.rebaseMergeAllowed) {
            config.mergeMethod = 'rebase';
        }
        else if (repo.squashMergeAllowed) {
            config.mergeMethod = 'squash';
        }
        else if (repo.mergeCommitAllowed) {
            config.mergeMethod = 'merge';
        }
        else {
            // This happens if we don't have Administrator read access, it is not a critical error
            logger_1.logger.debug('Could not find allowed merge methods for repo');
        }
        config.autoMergeAllowed = repo.autoMergeAllowed;
        config.hasIssuesEnabled = repo.hasIssuesEnabled;
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.debug({ err }, 'Caught initRepo error');
        if (err.message === error_messages_1.REPOSITORY_ARCHIVED ||
            err.message === error_messages_1.REPOSITORY_RENAMED ||
            err.message === error_messages_1.REPOSITORY_NOT_FOUND) {
            throw err;
        }
        if (err.statusCode === 403) {
            throw new Error(error_messages_1.REPOSITORY_ACCESS_FORBIDDEN);
        }
        if (err.statusCode === 404) {
            throw new Error(error_messages_1.REPOSITORY_NOT_FOUND);
        }
        if (err.message.startsWith('Repository access blocked')) {
            throw new Error(error_messages_1.REPOSITORY_BLOCKED);
        }
        if (err.message === error_messages_1.REPOSITORY_FORKED) {
            throw err;
        }
        if (err.message === error_messages_1.REPOSITORY_DISABLED) {
            throw err;
        }
        if (err.message === 'Response code 451 (Unavailable for Legal Reasons)') {
            throw new Error(error_messages_1.REPOSITORY_ACCESS_FORBIDDEN);
        }
        logger_1.logger.debug({ err }, 'Unknown GitHub initRepo error');
        throw err;
    }
    // This shouldn't be necessary, but occasional strange errors happened until it was added
    config.issueList = null;
    config.prList = null;
    config.forkMode = !!forkMode;
    if (forkMode) {
        logger_1.logger.debug('Bot is in forkMode');
        config.forkToken = forkToken;
        // save parent name then delete
        config.parentRepo = config.repository;
        config.repository = null;
        // Get list of existing repos
        platformConfig.existingRepos ?? (platformConfig.existingRepos = (await githubApi.getJson('user/repos?per_page=100', {
            token: forkToken || opts.token,
            paginate: true,
            pageLimit: 100,
        })).body.map((r) => r.full_name));
        try {
            const forkedRepo = await githubApi.postJson(`repos/${repository}/forks`, {
                token: forkToken || opts.token,
            });
            config.repository = forkedRepo.body.full_name;
            const forkDefaultBranch = forkedRepo.body.default_branch;
            if (forkDefaultBranch !== config.defaultBranch) {
                const body = {
                    ref: `refs/heads/${config.defaultBranch}`,
                    sha: repo.defaultBranchRef.target.oid,
                };
                logger_1.logger.debug({
                    defaultBranch: config.defaultBranch,
                    forkDefaultBranch,
                    body,
                }, 'Fork has different default branch to parent, attempting to create branch');
                try {
                    await githubApi.postJson(`repos/${config.repository}/git/refs`, {
                        body,
                        token: forkToken,
                    });
                    logger_1.logger.debug('Created new default branch in fork');
                }
                catch (err) /* istanbul ignore next */ {
                    if (err.response?.body?.message === 'Reference already exists') {
                        logger_1.logger.debug(`Branch ${config.defaultBranch} already exists in the fork`);
                    }
                    else {
                        logger_1.logger.warn({ err, body: err.response?.body }, 'Could not create parent defaultBranch in fork');
                    }
                }
                logger_1.logger.debug(`Setting ${config.defaultBranch} as default branch for ${config.repository}`);
                try {
                    await githubApi.patchJson(`repos/${config.repository}`, {
                        body: {
                            name: config.repository.split('/')[1],
                            default_branch: config.defaultBranch,
                        },
                        token: forkToken,
                    });
                    logger_1.logger.debug('Successfully changed default branch for fork');
                }
                catch (err) /* istanbul ignore next */ {
                    logger_1.logger.warn({ err }, 'Could not set default branch');
                }
            }
        }
        catch (err) /* istanbul ignore next */ {
            logger_1.logger.debug({ err }, 'Error forking repository');
            throw new Error(error_messages_1.REPOSITORY_CANNOT_FORK);
        }
        if (platformConfig.existingRepos.includes(config.repository)) {
            logger_1.logger.debug({ repository_fork: config.repository }, 'Found existing fork');
            // This is a lovely "hack" by GitHub that lets us force update our fork's default branch
            // with the base commit from the parent repository
            const url = `repos/${config.repository}/git/refs/heads/${config.defaultBranch}`;
            const sha = repo.defaultBranchRef.target.oid;
            try {
                logger_1.logger.debug(`Updating forked repository default sha ${sha} to match upstream`);
                await githubApi.patchJson(url, {
                    body: {
                        sha,
                        force: true,
                    },
                    token: forkToken || opts.token,
                });
            }
            catch (err) /* istanbul ignore next */ {
                logger_1.logger.warn({ url, sha, err: err.err || err }, 'Error updating fork from upstream - cannot continue');
                if (err instanceof external_host_error_1.ExternalHostError) {
                    throw err;
                }
                throw new external_host_error_1.ExternalHostError(err);
            }
        }
        else {
            logger_1.logger.debug({ repository_fork: config.repository }, 'Created fork');
            platformConfig.existingRepos.push(config.repository);
            // Wait an arbitrary 30s to hopefully give GitHub enough time for forking to complete
            await (0, delay_1.default)(30000);
        }
    }
    const parsedEndpoint = url_1.default.parse(platformConfig.endpoint);
    // istanbul ignore else
    if (forkMode) {
        logger_1.logger.debug('Using forkToken for git init');
        parsedEndpoint.auth = config.forkToken ?? null;
    }
    else {
        const tokenType = opts.token?.startsWith('x-access-token:')
            ? 'app'
            : 'personal access';
        logger_1.logger.debug(`Using ${tokenType} token for git init`);
        parsedEndpoint.auth = opts.token ?? null;
    }
    // TODO: null checks #7154
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    parsedEndpoint.host = parsedEndpoint.host.replace('api.github.com', 'github.com');
    parsedEndpoint.pathname = config.repository + '.git';
    const url = url_1.default.format(parsedEndpoint);
    await git.initRepo({
        ...config,
        url,
    });
    const repoConfig = {
        defaultBranch: config.defaultBranch,
        isFork: repo.isFork === true,
    };
    return repoConfig;
}
exports.initRepo = initRepo;
async function getRepoForceRebase() {
    if (config.repoForceRebase === undefined) {
        try {
            config.repoForceRebase = false;
            const branchProtection = await getBranchProtection(config.defaultBranch);
            logger_1.logger.debug('Found branch protection');
            if (branchProtection.required_pull_request_reviews) {
                logger_1.logger.debug('Branch protection: PR Reviews are required before merging');
                config.prReviewsRequired = true;
            }
            if (branchProtection.required_status_checks) {
                if (branchProtection.required_status_checks.strict) {
                    logger_1.logger.debug('Branch protection: PRs must be up-to-date before merging');
                    config.repoForceRebase = true;
                }
            }
            if (branchProtection.restrictions) {
                logger_1.logger.debug({
                    users: branchProtection.restrictions.users,
                    teams: branchProtection.restrictions.teams,
                }, 'Branch protection: Pushing to branch is restricted');
                config.pushProtection = true;
            }
        }
        catch (err) {
            if (err.statusCode === 404) {
                logger_1.logger.debug(`No branch protection found`);
            }
            else if (err.message === error_messages_1.PLATFORM_INTEGRATION_UNAUTHORIZED ||
                err.statusCode === 403) {
                logger_1.logger.debug('Branch protection: Do not have permissions to detect branch protection');
            }
            else {
                throw err;
            }
        }
    }
    return !!config.repoForceRebase;
}
exports.getRepoForceRebase = getRepoForceRebase;
function cachePr(pr) {
    config.prList ?? (config.prList = []);
    if (pr) {
        for (let idx = 0; idx < config.prList.length; idx += 1) {
            const cachedPr = config.prList[idx];
            if (cachedPr.number === pr.number) {
                config.prList[idx] = pr;
                return;
            }
        }
        config.prList.push(pr);
    }
}
// Fetch fresh Pull Request and cache it when possible
async function fetchPr(prNo) {
    const { body: ghRestPr } = await githubApi.getJson(`repos/${config.parentRepo || config.repository}/pulls/${prNo}`);
    const result = (0, common_1.coerceRestPr)(ghRestPr);
    cachePr(result);
    return result;
}
// Gets details for a PR
async function getPr(prNo) {
    if (!prNo) {
        return null;
    }
    const prList = await getPrList();
    let pr = prList.find(({ number }) => number === prNo) ?? null;
    if (pr) {
        logger_1.logger.debug('Returning PR from cache');
    }
    pr ?? (pr = await fetchPr(prNo));
    return pr;
}
exports.getPr = getPr;
function matchesState(state, desiredState) {
    if (desiredState === types_1.PrState.All) {
        return true;
    }
    if (desiredState.startsWith('!')) {
        return state !== desiredState.substring(1);
    }
    return state === desiredState;
}
async function getPrList() {
    if (!config.prList) {
        const repo = config.parentRepo ?? config.repository;
        const username = !config.forkMode && !config.ignorePrAuthor && config.renovateUsername
            ? config.renovateUsername
            : null;
        // TODO: check null `repo` #7154
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        const prCache = await (0, pr_1.getPrCache)(githubApi, repo, username);
        config.prList = Object.values(prCache);
    }
    return config.prList;
}
exports.getPrList = getPrList;
async function findPr({ branchName, prTitle, state = types_1.PrState.All, }) {
    logger_1.logger.debug(`findPr(${branchName}, ${prTitle}, ${state})`);
    const prList = await getPrList();
    const pr = prList.find((p) => p.sourceBranch === branchName &&
        (!prTitle || p.title === prTitle) &&
        matchesState(p.state, state) &&
        (config.forkMode || config.repository === p.sourceRepo) // #5188
    );
    if (pr) {
        logger_1.logger.debug(`Found PR #${pr.number}`);
    }
    return pr ?? null;
}
exports.findPr = findPr;
const REOPEN_THRESHOLD_MILLIS = 1000 * 60 * 60 * 24 * 7;
// Returns the Pull Request for a branch. Null if not exists.
async function getBranchPr(branchName) {
    logger_1.logger.debug(`getBranchPr(${branchName})`);
    const openPr = await findPr({
        branchName,
        state: types_1.PrState.Open,
    });
    if (openPr) {
        return openPr;
    }
    const autoclosedPr = await findPr({
        branchName,
        state: types_1.PrState.Closed,
    });
    if (autoclosedPr?.title?.endsWith(' - autoclosed') &&
        autoclosedPr?.closedAt) {
        const closedMillisAgo = luxon_1.DateTime.fromISO(autoclosedPr.closedAt)
            .diffNow()
            .negate()
            .toMillis();
        if (closedMillisAgo > REOPEN_THRESHOLD_MILLIS) {
            return null;
        }
        logger_1.logger.debug({ autoclosedPr }, 'Found autoclosed PR for branch');
        if (global_1.GlobalConfig.get('dryRun')) {
            logger_1.logger.info('DRY-RUN: Would try to reopen autoclosed PR');
            return null;
        }
        const { sha, number } = autoclosedPr;
        try {
            await githubApi.postJson(`repos/${config.repository}/git/refs`, {
                body: { ref: `refs/heads/${branchName}`, sha },
            });
            logger_1.logger.debug({ branchName, sha }, 'Recreated autoclosed branch');
        }
        catch (err) {
            logger_1.logger.debug('Could not recreate autoclosed branch - skipping reopen');
            return null;
        }
        try {
            const title = autoclosedPr.title.replace((0, regex_1.regEx)(/ - autoclosed$/), '');
            const { body: ghPr } = await githubApi.patchJson(`repos/${config.repository}/pulls/${number}`, {
                body: {
                    state: 'open',
                    title,
                },
            });
            logger_1.logger.info({ branchName, title, number }, 'Successfully reopened autoclosed PR');
            const result = (0, common_1.coerceRestPr)(ghPr);
            cachePr(result);
            return result;
        }
        catch (err) {
            logger_1.logger.debug('Could not reopen autoclosed PR');
            return null;
        }
    }
    return null;
}
exports.getBranchPr = getBranchPr;
async function getStatus(branchName, useCache = true) {
    const commitStatusUrl = `repos/${config.repository}/commits/${escapeHash(branchName)}/status`;
    return (await githubApi.getJson(commitStatusUrl, { useCache })).body;
}
// Returns the combined status for a branch.
async function getBranchStatus(branchName) {
    logger_1.logger.debug(`getBranchStatus(${branchName})`);
    let commitStatus;
    try {
        commitStatus = await getStatus(branchName);
    }
    catch (err) /* istanbul ignore next */ {
        if (err.statusCode === 404) {
            logger_1.logger.debug('Received 404 when checking branch status, assuming that branch has been deleted');
            throw new Error(error_messages_1.REPOSITORY_CHANGED);
        }
        logger_1.logger.debug('Unknown error when checking branch status');
        throw err;
    }
    logger_1.logger.debug({ state: commitStatus.state, statuses: commitStatus.statuses }, 'branch status check result');
    let checkRuns = [];
    // API is supported in oldest available GHE version 2.19
    try {
        const checkRunsUrl = `repos/${config.repository}/commits/${escapeHash(branchName)}/check-runs?per_page=100`;
        const opts = {
            headers: {
                accept: 'application/vnd.github.antiope-preview+json',
            },
            paginate: true,
            paginationField: 'check_runs',
        };
        const checkRunsRaw = (await githubApi.getJson(checkRunsUrl, opts)).body;
        if (checkRunsRaw.check_runs?.length) {
            checkRuns = checkRunsRaw.check_runs.map((run) => ({
                name: run.name,
                status: run.status,
                conclusion: run.conclusion,
            }));
            logger_1.logger.debug({ checkRuns }, 'check runs result');
        }
        else {
            // istanbul ignore next
            logger_1.logger.debug({ result: checkRunsRaw }, 'No check runs found');
        }
    }
    catch (err) /* istanbul ignore next */ {
        if (err instanceof external_host_error_1.ExternalHostError) {
            throw err;
        }
        if (err.statusCode === 403 ||
            err.message === error_messages_1.PLATFORM_INTEGRATION_UNAUTHORIZED) {
            logger_1.logger.debug('No permission to view check runs');
        }
        else {
            logger_1.logger.warn({ err }, 'Error retrieving check runs');
        }
    }
    if (checkRuns.length === 0) {
        if (commitStatus.state === 'success') {
            return types_1.BranchStatus.green;
        }
        if (commitStatus.state === 'failure') {
            return types_1.BranchStatus.red;
        }
        return types_1.BranchStatus.yellow;
    }
    if (commitStatus.state === 'failure' ||
        checkRuns.some((run) => run.conclusion === 'failure')) {
        return types_1.BranchStatus.red;
    }
    if ((commitStatus.state === 'success' || commitStatus.statuses.length === 0) &&
        checkRuns.every((run) => ['skipped', 'neutral', 'success'].includes(run.conclusion))) {
        return types_1.BranchStatus.green;
    }
    return types_1.BranchStatus.yellow;
}
exports.getBranchStatus = getBranchStatus;
async function getStatusCheck(branchName, useCache = true) {
    const branchCommit = git.getBranchCommit(branchName);
    const url = `repos/${config.repository}/commits/${branchCommit}/statuses`;
    return (await githubApi.getJson(url, { useCache })).body;
}
const githubToRenovateStatusMapping = {
    success: types_1.BranchStatus.green,
    error: types_1.BranchStatus.red,
    failure: types_1.BranchStatus.red,
    pending: types_1.BranchStatus.yellow,
};
async function getBranchStatusCheck(branchName, context) {
    try {
        const res = await getStatusCheck(branchName);
        for (const check of res) {
            if (check.context === context) {
                return (githubToRenovateStatusMapping[check.state] || types_1.BranchStatus.yellow);
            }
        }
        return null;
    }
    catch (err) /* istanbul ignore next */ {
        if (err.statusCode === 404) {
            logger_1.logger.debug('Commit not found when checking statuses');
            throw new Error(error_messages_1.REPOSITORY_CHANGED);
        }
        throw err;
    }
}
exports.getBranchStatusCheck = getBranchStatusCheck;
async function setBranchStatus({ branchName, context, description, state, url: targetUrl, }) {
    // istanbul ignore if
    if (config.parentRepo) {
        logger_1.logger.debug('Cannot set branch status when in forking mode');
        return;
    }
    const existingStatus = await getBranchStatusCheck(branchName, context);
    if (existingStatus === state) {
        return;
    }
    logger_1.logger.debug({ branch: branchName, context, state }, 'Setting branch status');
    let url;
    try {
        const branchCommit = git.getBranchCommit(branchName);
        url = `repos/${config.repository}/statuses/${branchCommit}`;
        const renovateToGitHubStateMapping = {
            green: 'success',
            yellow: 'pending',
            red: 'failure',
        };
        const options = {
            state: renovateToGitHubStateMapping[state],
            description,
            context,
        };
        if (targetUrl) {
            options.target_url = targetUrl;
        }
        await githubApi.postJson(url, { body: options });
        // update status cache
        await getStatus(branchName, false);
        await getStatusCheck(branchName, false);
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.debug({ err, url }, 'Caught error setting branch status - aborting');
        throw new Error(error_messages_1.REPOSITORY_CHANGED);
    }
}
exports.setBranchStatus = setBranchStatus;
// Issue
/* istanbul ignore next */
async function getIssues() {
    const result = await githubApi.queryRepoField(graphql_1.getIssuesQuery, 'issues', {
        variables: {
            owner: config.repositoryOwner,
            name: config.repositoryName,
            user: config.renovateUsername,
        },
    });
    logger_1.logger.debug(`Retrieved ${result.length} issues`);
    return result.map((issue) => ({
        ...issue,
        state: issue.state?.toLowerCase(),
    }));
}
async function getIssueList() {
    // istanbul ignore if
    if (config.hasIssuesEnabled === false) {
        return [];
    }
    if (!config.issueList) {
        logger_1.logger.debug('Retrieving issueList');
        config.issueList = await getIssues();
    }
    return config.issueList;
}
exports.getIssueList = getIssueList;
async function getIssue(number, useCache = true) {
    // istanbul ignore if
    if (config.hasIssuesEnabled === false) {
        return null;
    }
    try {
        const issueBody = (await githubApi.getJson(`repos/${config.parentRepo || config.repository}/issues/${number}`, { useCache })).body.body;
        return {
            number,
            body: issueBody,
        };
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.debug({ err, number }, 'Error getting issue');
        return null;
    }
}
exports.getIssue = getIssue;
async function findIssue(title) {
    logger_1.logger.debug(`findIssue(${title})`);
    const [issue] = (await getIssueList()).filter((i) => i.state === 'open' && i.title === title);
    if (!issue) {
        return null;
    }
    logger_1.logger.debug(`Found issue ${issue.number}`);
    // TODO: can number be required? #7154
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    return getIssue(issue.number);
}
exports.findIssue = findIssue;
async function closeIssue(issueNumber) {
    logger_1.logger.debug(`closeIssue(${issueNumber})`);
    await githubApi.patchJson(`repos/${config.parentRepo || config.repository}/issues/${issueNumber}`, {
        body: { state: 'closed' },
    });
}
async function ensureIssue({ title, reuseTitle, body: rawBody, labels, once = false, shouldReOpen = true, }) {
    logger_1.logger.debug(`ensureIssue(${title})`);
    // istanbul ignore if
    if (config.hasIssuesEnabled === false) {
        logger_1.logger.info('Cannot ensure issue because issues are disabled in this repository');
        return null;
    }
    const body = (0, sanitize_1.sanitize)(rawBody);
    try {
        const issueList = await getIssueList();
        let issues = issueList.filter((i) => i.title === title);
        if (!issues.length) {
            issues = issueList.filter((i) => i.title === reuseTitle);
            if (issues.length) {
                logger_1.logger.debug({ reuseTitle, title }, 'Reusing issue title');
            }
        }
        if (issues.length) {
            let issue = issues.find((i) => i.state === 'open');
            if (!issue) {
                if (once) {
                    logger_1.logger.debug('Issue already closed - skipping recreation');
                    return null;
                }
                if (shouldReOpen) {
                    logger_1.logger.debug('Reopening previously closed issue');
                }
                issue = issues[issues.length - 1];
            }
            for (const i of issues) {
                if (i.state === 'open' && i.number !== issue.number) {
                    logger_1.logger.warn(`Closing duplicate issue ${i.number}`);
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                    await closeIssue(i.number);
                }
            }
            const issueBody = (await githubApi.getJson(`repos/${config.parentRepo || config.repository}/issues/${issue.number}`)).body.body;
            if (issue.title === title &&
                issueBody === body &&
                issue.state === 'open') {
                logger_1.logger.debug('Issue is open and up to date - nothing to do');
                return null;
            }
            if (shouldReOpen) {
                logger_1.logger.debug('Patching issue');
                const data = { body, state: 'open', title };
                if (labels) {
                    data.labels = labels;
                }
                await githubApi.patchJson(`repos/${config.parentRepo || config.repository}/issues/${issue.number}`, {
                    body: data,
                });
                logger_1.logger.debug('Issue updated');
                return 'updated';
            }
        }
        await githubApi.postJson(`repos/${config.parentRepo || config.repository}/issues`, {
            body: {
                title,
                body,
                labels: labels || [],
            },
        });
        logger_1.logger.info('Issue created');
        // reset issueList so that it will be fetched again as-needed
        config.issueList = null;
        return 'created';
    }
    catch (err) /* istanbul ignore next */ {
        if (err.body?.message?.startsWith('Issues are disabled for this repo')) {
            logger_1.logger.debug(`Issues are disabled, so could not create issue: ${title}`);
        }
        else {
            logger_1.logger.warn({ err }, 'Could not ensure issue');
        }
    }
    return null;
}
exports.ensureIssue = ensureIssue;
async function ensureIssueClosing(title) {
    logger_1.logger.trace(`ensureIssueClosing(${title})`);
    // istanbul ignore if
    if (config.hasIssuesEnabled === false) {
        logger_1.logger.info('Cannot ensure issue because issues are disabled in this repository');
        return;
    }
    const issueList = await getIssueList();
    for (const issue of issueList) {
        if (issue.state === 'open' && issue.title === title) {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            await closeIssue(issue.number);
            logger_1.logger.debug({ number: issue.number }, 'Issue closed');
        }
    }
}
exports.ensureIssueClosing = ensureIssueClosing;
async function addAssignees(issueNo, assignees) {
    logger_1.logger.debug(`Adding assignees '${assignees.join(', ')}' to #${issueNo}`);
    const repository = config.parentRepo || config.repository;
    await githubApi.postJson(`repos/${repository}/issues/${issueNo}/assignees`, {
        body: {
            assignees,
        },
    });
}
exports.addAssignees = addAssignees;
async function addReviewers(prNo, reviewers) {
    logger_1.logger.debug(`Adding reviewers '${reviewers.join(', ')}' to #${prNo}`);
    const userReviewers = reviewers.filter((e) => !e.startsWith('team:'));
    const teamReviewers = reviewers
        .filter((e) => e.startsWith('team:'))
        .map((e) => e.replace((0, regex_1.regEx)(/^team:/), ''));
    try {
        await githubApi.postJson(`repos/${config.parentRepo || config.repository}/pulls/${prNo}/requested_reviewers`, {
            body: {
                reviewers: userReviewers,
                team_reviewers: teamReviewers,
            },
        });
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.warn({ err }, 'Failed to assign reviewer');
    }
}
exports.addReviewers = addReviewers;
async function addLabels(issueNo, labels) {
    logger_1.logger.debug(`Adding labels '${labels?.join(', ')}' to #${issueNo}`);
    const repository = config.parentRepo || config.repository;
    if (is_1.default.array(labels) && labels.length) {
        await githubApi.postJson(`repos/${repository}/issues/${issueNo}/labels`, {
            body: labels,
        });
    }
}
async function deleteLabel(issueNo, label) {
    logger_1.logger.debug(`Deleting label ${label} from #${issueNo}`);
    const repository = config.parentRepo || config.repository;
    try {
        await githubApi.deleteJson(`repos/${repository}/issues/${issueNo}/labels/${label}`);
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.warn({ err, issueNo, label }, 'Failed to delete label');
    }
}
exports.deleteLabel = deleteLabel;
async function addComment(issueNo, body) {
    // POST /repos/:owner/:repo/issues/:number/comments
    await githubApi.postJson(`repos/${config.parentRepo || config.repository}/issues/${issueNo}/comments`, {
        body: { body },
    });
}
async function editComment(commentId, body) {
    // PATCH /repos/:owner/:repo/issues/comments/:id
    await githubApi.patchJson(`repos/${config.parentRepo || config.repository}/issues/comments/${commentId}`, {
        body: { body },
    });
}
async function deleteComment(commentId) {
    // DELETE /repos/:owner/:repo/issues/comments/:id
    await githubApi.deleteJson(`repos/${config.parentRepo || config.repository}/issues/comments/${commentId}`);
}
async function getComments(issueNo) {
    // GET /repos/:owner/:repo/issues/:number/comments
    logger_1.logger.debug(`Getting comments for #${issueNo}`);
    const url = `repos/${config.parentRepo || config.repository}/issues/${issueNo}/comments?per_page=100`;
    try {
        const comments = (await githubApi.getJson(url, {
            paginate: true,
        })).body;
        logger_1.logger.debug(`Found ${comments.length} comments`);
        return comments;
    }
    catch (err) /* istanbul ignore next */ {
        if (err.statusCode === 404) {
            logger_1.logger.debug('404 response when retrieving comments');
            throw new external_host_error_1.ExternalHostError(err, constants_1.PlatformId.Github);
        }
        throw err;
    }
}
async function ensureComment({ number, topic, content, }) {
    const sanitizedContent = (0, sanitize_1.sanitize)(content);
    try {
        const comments = await getComments(number);
        let body;
        let commentId = null;
        let commentNeedsUpdating = false;
        if (topic) {
            logger_1.logger.debug(`Ensuring comment "${topic}" in #${number}`);
            body = `### ${topic}\n\n${sanitizedContent}`;
            comments.forEach((comment) => {
                if (comment.body.startsWith(`### ${topic}\n\n`)) {
                    commentId = comment.id;
                    commentNeedsUpdating = comment.body !== body;
                }
            });
        }
        else {
            logger_1.logger.debug(`Ensuring content-only comment in #${number}`);
            body = `${sanitizedContent}`;
            comments.forEach((comment) => {
                if (comment.body === body) {
                    commentId = comment.id;
                    commentNeedsUpdating = false;
                }
            });
        }
        if (!commentId) {
            await addComment(number, body);
            logger_1.logger.info({ repository: config.repository, issueNo: number, topic }, 'Comment added');
        }
        else if (commentNeedsUpdating) {
            await editComment(commentId, body);
            logger_1.logger.debug({ repository: config.repository, issueNo: number }, 'Comment updated');
        }
        else {
            logger_1.logger.debug('Comment is already update-to-date');
        }
        return true;
    }
    catch (err) /* istanbul ignore next */ {
        if (err instanceof external_host_error_1.ExternalHostError) {
            throw err;
        }
        if (err.body?.message?.includes('is locked')) {
            logger_1.logger.debug('Issue is locked - cannot add comment');
        }
        else {
            logger_1.logger.warn({ err }, 'Error ensuring comment');
        }
        return false;
    }
}
exports.ensureComment = ensureComment;
async function ensureCommentRemoval(deleteConfig) {
    const { number: issueNo } = deleteConfig;
    const key = deleteConfig.type === 'by-topic'
        ? deleteConfig.topic
        : deleteConfig.content;
    logger_1.logger.trace(`Ensuring comment "${key}" in #${issueNo} is removed`);
    const comments = await getComments(issueNo);
    let commentId = null;
    if (deleteConfig.type === 'by-topic') {
        const byTopic = (comment) => comment.body.startsWith(`### ${deleteConfig.topic}\n\n`);
        commentId = comments.find(byTopic)?.id;
    }
    else if (deleteConfig.type === 'by-content') {
        const byContent = (comment) => comment.body.trim() === deleteConfig.content;
        commentId = comments.find(byContent)?.id;
    }
    try {
        if (commentId) {
            logger_1.logger.debug({ issueNo }, 'Removing comment');
            await deleteComment(commentId);
        }
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.warn({ err }, 'Error deleting comment');
    }
}
exports.ensureCommentRemoval = ensureCommentRemoval;
// Pull Request
async function tryPrAutomerge(prNumber, prNodeId, platformOptions) {
    if (platformConfig.isGhe || !platformOptions?.usePlatformAutomerge) {
        return;
    }
    if (!config.autoMergeAllowed) {
        logger_1.logger.debug({ prNumber }, 'GitHub-native automerge: not enabled in repo settings');
        return;
    }
    try {
        const mergeMethod = config.mergeMethod?.toUpperCase() || 'MERGE';
        const variables = { pullRequestId: prNodeId, mergeMethod };
        const queryOptions = { variables };
        const res = await githubApi.requestGraphql(graphql_1.enableAutoMergeMutation, queryOptions);
        if (res?.errors) {
            logger_1.logger.debug({ prNumber, errors: res.errors }, 'GitHub-native automerge: fail');
            return;
        }
        logger_1.logger.debug({ prNumber }, 'GitHub-native automerge: success');
    }
    catch (err) /* istanbul ignore next: missing test #7154 */ {
        logger_1.logger.warn({ prNumber, err }, 'GitHub-native automerge: REST API error');
    }
}
// Creates PR and returns PR number
async function createPr({ sourceBranch, targetBranch, prTitle: title, prBody: rawBody, labels, draftPR = false, platformOptions, }) {
    const body = (0, sanitize_1.sanitize)(rawBody);
    const base = targetBranch;
    // Include the repository owner to handle forkMode and regular mode
    // TODO: can `repository` be null? #7154
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const head = `${config.repository.split('/')[0]}:${sourceBranch}`;
    const options = {
        body: {
            title,
            head,
            base,
            body,
            draft: draftPR,
        },
    };
    // istanbul ignore if
    if (config.forkToken) {
        options.token = config.forkToken;
        options.body.maintainer_can_modify = true;
    }
    logger_1.logger.debug({ title, head, base, draft: draftPR }, 'Creating PR');
    const ghPr = (await githubApi.postJson(`repos/${config.parentRepo || config.repository}/pulls`, options)).body;
    logger_1.logger.debug({ branch: sourceBranch, pr: ghPr.number, draft: draftPR }, 'PR created');
    const { number, node_id } = ghPr;
    await addLabels(number, labels);
    await tryPrAutomerge(number, node_id, platformOptions);
    const result = (0, common_1.coerceRestPr)(ghPr);
    cachePr(result);
    return result;
}
exports.createPr = createPr;
async function updatePr({ number: prNo, prTitle: title, prBody: rawBody, state, }) {
    logger_1.logger.debug(`updatePr(${prNo}, ${title}, body)`);
    const body = (0, sanitize_1.sanitize)(rawBody);
    const patchBody = { title };
    if (body) {
        patchBody.body = body;
    }
    if (state) {
        patchBody.state = state;
    }
    const options = {
        body: patchBody,
    };
    // istanbul ignore if
    if (config.forkToken) {
        options.token = config.forkToken;
    }
    try {
        const { body: ghPr } = await githubApi.patchJson(`repos/${config.parentRepo || config.repository}/pulls/${prNo}`, options);
        const result = (0, common_1.coerceRestPr)(ghPr);
        cachePr(result);
        logger_1.logger.debug({ pr: prNo }, 'PR updated');
    }
    catch (err) /* istanbul ignore next */ {
        if (err instanceof external_host_error_1.ExternalHostError) {
            throw err;
        }
        logger_1.logger.warn({ err }, 'Error updating PR');
    }
}
exports.updatePr = updatePr;
async function mergePr({ branchName, id: prNo, }) {
    logger_1.logger.debug(`mergePr(${prNo}, ${branchName})`);
    // istanbul ignore if
    if (config.prReviewsRequired) {
        logger_1.logger.debug({ branch: branchName, prNo }, 'Branch protection: Attempting to merge PR when PR reviews are enabled');
        const repository = config.parentRepo || config.repository;
        const reviews = await githubApi.getJson(`repos/${repository}/pulls/${prNo}/reviews`);
        const isApproved = reviews.body.some((review) => review.state === 'APPROVED');
        if (!isApproved) {
            logger_1.logger.debug({ branch: branchName, prNo }, 'Branch protection: Cannot automerge PR until there is an approving review');
            return false;
        }
        logger_1.logger.debug('Found approving reviews');
    }
    const url = `repos/${config.parentRepo || config.repository}/pulls/${prNo}/merge`;
    const options = {
        body: {},
    };
    // istanbul ignore if
    if (config.forkToken) {
        options.token = config.forkToken;
    }
    let automerged = false;
    let automergeResult;
    if (config.mergeMethod) {
        // This path is taken if we have auto-detected the allowed merge types from the repo
        options.body.merge_method = config.mergeMethod;
        try {
            logger_1.logger.debug({ options, url }, `mergePr`);
            automergeResult = await githubApi.putJson(url, options);
            automerged = true;
        }
        catch (err) {
            if (err.statusCode === 404 || err.statusCode === 405) {
                // istanbul ignore next
                logger_1.logger.debug({ response: err.response ? err.response.body : undefined }, 'GitHub blocking PR merge -- will keep trying');
            }
            else {
                logger_1.logger.warn({ err }, `Failed to ${config.mergeMethod} merge PR`);
                return false;
            }
        }
    }
    if (!automerged) {
        // We need to guess the merge method and try squash -> rebase -> merge
        options.body.merge_method = 'rebase';
        try {
            logger_1.logger.debug({ options, url }, `mergePr`);
            automergeResult = await githubApi.putJson(url, options);
        }
        catch (err1) {
            logger_1.logger.debug({ err: err1 }, `Failed to rebase merge PR`);
            try {
                options.body.merge_method = 'squash';
                logger_1.logger.debug({ options, url }, `mergePr`);
                automergeResult = await githubApi.putJson(url, options);
            }
            catch (err2) {
                logger_1.logger.debug({ err: err2 }, `Failed to merge squash PR`);
                try {
                    options.body.merge_method = 'merge';
                    logger_1.logger.debug({ options, url }, `mergePr`);
                    automergeResult = await githubApi.putJson(url, options);
                }
                catch (err3) {
                    logger_1.logger.debug({ err: err3 }, `Failed to merge commit PR`);
                    logger_1.logger.info({ pr: prNo }, 'All merge attempts failed');
                    return false;
                }
            }
        }
    }
    logger_1.logger.debug({ automergeResult: automergeResult.body, pr: prNo }, 'PR merged');
    const cachedPr = config.prList?.find(({ number }) => number === prNo);
    if (cachedPr) {
        cachePr({ ...cachedPr, state: types_1.PrState.Merged });
    }
    return true;
}
exports.mergePr = mergePr;
function massageMarkdown(input) {
    if (platformConfig.isGhe) {
        return (0, pr_body_1.smartTruncate)(input, 60000);
    }
    const massagedInput = (0, massage_markdown_links_1.massageMarkdownLinks)(input)
        // to be safe, replace all github.com links with renovatebot redirector
        .replace((0, regex_1.regEx)(/href="https?:\/\/github.com\//g), 'href="https://togithub.com/')
        .replace((0, regex_1.regEx)(/]\(https:\/\/github\.com\//g), '](https://togithub.com/')
        .replace((0, regex_1.regEx)(/]: https:\/\/github\.com\//g), ']: https://togithub.com/');
    return (0, pr_body_1.smartTruncate)(massagedInput, 60000);
}
exports.massageMarkdown = massageMarkdown;
async function getVulnerabilityAlerts() {
    let vulnerabilityAlerts;
    const gheSupportsStateFilter = semver_1.default.satisfies(
    // semver not null safe, accepts null and undefined
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    platformConfig.gheVersion, '>=3.5');
    const filterByState = !platformConfig.isGhe || gheSupportsStateFilter;
    const query = (0, graphql_1.vulnerabilityAlertsQuery)(filterByState);
    try {
        vulnerabilityAlerts = await githubApi.queryRepoField(query, 'vulnerabilityAlerts', {
            variables: { owner: config.repositoryOwner, name: config.repositoryName },
            paginate: false,
            acceptHeader: 'application/vnd.github.vixen-preview+json',
        });
    }
    catch (err) {
        logger_1.logger.debug({ err }, 'Error retrieving vulnerability alerts');
        logger_1.logger.warn({
            url: 'https://docs.renovatebot.com/configuration-options/#vulnerabilityalerts',
        }, 'Cannot access vulnerability alerts. Please ensure permissions have been granted.');
    }
    let alerts = [];
    try {
        if (vulnerabilityAlerts?.length) {
            alerts = vulnerabilityAlerts.map((edge) => edge.node);
            const shortAlerts = {};
            if (alerts.length) {
                logger_1.logger.trace({ alerts }, 'GitHub vulnerability details');
                for (const alert of alerts) {
                    if (alert.securityVulnerability === null) {
                        // As described in the documentation, there are cases in which
                        // GitHub API responds with `"securityVulnerability": null`.
                        // But it's may be faulty, so skip processing it here.
                        continue;
                    }
                    const { package: { name, ecosystem }, vulnerableVersionRange, firstPatchedVersion, } = alert.securityVulnerability;
                    const patch = firstPatchedVersion?.identifier;
                    const key = `${ecosystem.toLowerCase()}/${name}`;
                    const range = vulnerableVersionRange;
                    const elem = shortAlerts[key] || {};
                    elem[range] = patch || null;
                    shortAlerts[key] = elem;
                }
                logger_1.logger.debug({ alerts: shortAlerts }, 'GitHub vulnerability details');
            }
        }
        else {
            logger_1.logger.debug('No vulnerability alerts found');
        }
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.error({ err }, 'Error processing vulnerabity alerts');
    }
    return alerts;
}
exports.getVulnerabilityAlerts = getVulnerabilityAlerts;
async function pushFiles({ branchName, message }, { parentCommitSha, commitSha }) {
    try {
        // Push the commit to GitHub using a custom ref
        // The associated blobs will be pushed automatically
        await (0, git_1.pushCommitToRenovateRef)(commitSha, branchName);
        // Get all the blobs which the commit/tree points to
        // The blob SHAs will be the same locally as on GitHub
        const treeItems = await (0, git_1.listCommitTree)(commitSha);
        // For reasons unknown, we need to recreate our tree+commit on GitHub
        // Attempting to reuse the tree or commit SHA we pushed does not work
        const treeRes = await githubApi.postJson(`/repos/${config.repository}/git/trees`, { body: { tree: treeItems } });
        const treeSha = treeRes.body.sha;
        // Now we recreate the commit using the tree we recreated the step before
        const commitRes = await githubApi.postJson(`/repos/${config.repository}/git/commits`, { body: { message, tree: treeSha, parents: [parentCommitSha] } });
        const remoteCommitSha = commitRes.body.sha;
        // Create branch if it didn't already exist, update it otherwise
        if (git.branchExists(branchName)) {
            // This is the equivalent of a git force push
            // We are using this REST API because the GraphQL API doesn't support force push
            await githubApi.patchJson(`/repos/${config.repository}/git/refs/heads/${branchName}`, { body: { sha: remoteCommitSha, force: true } });
        }
        else {
            await githubApi.postJson(`/repos/${config.repository}/git/refs`, {
                body: { ref: `refs/heads/${branchName}`, sha: remoteCommitSha },
            });
        }
        return remoteCommitSha;
    }
    catch (err) {
        logger_1.logger.debug({ branchName, err }, 'Platform-native commit: unknown error');
        return null;
    }
}
async function commitFiles(config) {
    const commitResult = await git.prepareCommit(config); // Commit locally and don't push
    if (!commitResult) {
        const { branchName, files } = config;
        logger_1.logger.debug({ branchName, files: files.map(({ path }) => path) }, `Platform-native commit: unable to prepare for commit`);
        return null;
    }
    // Perform the commits using REST API
    const pushResult = await pushFiles(config, commitResult);
    if (!pushResult) {
        return null;
    }
    // Because the branch commit was done remotely via REST API, now we git fetch it locally.
    // We also do this step when committing/pushing using local git tooling.
    return git.fetchCommit(config);
}
exports.commitFiles = commitFiles;
//# sourceMappingURL=index.js.map