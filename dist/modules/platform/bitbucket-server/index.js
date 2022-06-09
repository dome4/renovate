"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVulnerabilityAlerts = exports.massageMarkdown = exports.mergePr = exports.updatePr = exports.createPr = exports.ensureCommentRemoval = exports.ensureComment = exports.deleteLabel = exports.addReviewers = exports.addAssignees = exports.ensureIssueClosing = exports.getIssueList = exports.ensureIssue = exports.findIssue = exports.setBranchStatus = exports.getBranchStatusCheck = exports.getBranchStatus = exports.refreshPr = exports.getBranchPr = exports.findPr = exports.getPrList = exports.getPr = exports.getRepoForceRebase = exports.initRepo = exports.getJsonFile = exports.getRawFile = exports.getRepos = exports.initPlatform = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const delay_1 = tslib_1.__importDefault(require("delay"));
const json5_1 = tslib_1.__importDefault(require("json5"));
const constants_1 = require("../../../constants");
const error_messages_1 = require("../../../constants/error-messages");
const logger_1 = require("../../../logger");
const types_1 = require("../../../types");
const git = tslib_1.__importStar(require("../../../util/git"));
const git_1 = require("../../../util/git");
const hostRules = tslib_1.__importStar(require("../../../util/host-rules"));
const bitbucket_server_1 = require("../../../util/http/bitbucket-server");
const regex_1 = require("../../../util/regex");
const sanitize_1 = require("../../../util/sanitize");
const url_1 = require("../../../util/url");
const pr_body_1 = require("../utils/pr-body");
const utils = tslib_1.__importStar(require("./utils"));
/*
 * Version: 5.3 (EOL Date: 15 Aug 2019)
 * See following docs for api information:
 * https://docs.atlassian.com/bitbucket-server/rest/5.3.0/bitbucket-rest.html
 * https://docs.atlassian.com/bitbucket-server/rest/5.3.0/bitbucket-build-rest.html
 *
 * See following page for uptodate supported versions
 * https://confluence.atlassian.com/support/atlassian-support-end-of-life-policy-201851003.html#AtlassianSupportEndofLifePolicy-BitbucketServer
 */
let config = {};
const bitbucketServerHttp = new bitbucket_server_1.BitbucketServerHttp();
const defaults = {
    hostType: constants_1.PlatformId.BitbucketServer,
};
/* istanbul ignore next */
function updatePrVersion(pr, version) {
    const res = Math.max(config.prVersions.get(pr) ?? 0, version);
    config.prVersions.set(pr, res);
    return res;
}
function initPlatform({ endpoint, username, password, }) {
    if (!endpoint) {
        throw new Error('Init: You must configure a Bitbucket Server endpoint');
    }
    if (!(username && password)) {
        throw new Error('Init: You must configure a Bitbucket Server username/password');
    }
    // TODO: Add a connection check that endpoint/username/password combination are valid (#9595)
    defaults.endpoint = (0, url_1.ensureTrailingSlash)(endpoint);
    (0, bitbucket_server_1.setBaseUrl)(defaults.endpoint);
    const platformConfig = {
        endpoint: defaults.endpoint,
    };
    return Promise.resolve(platformConfig);
}
exports.initPlatform = initPlatform;
// Get all repositories that the user has access to
async function getRepos() {
    logger_1.logger.debug('Autodiscovering Bitbucket Server repositories');
    try {
        const repos = await utils.accumulateValues(`./rest/api/1.0/repos?permission=REPO_WRITE&state=AVAILABLE`);
        const result = repos.map((r) => `${r.project.key.toLowerCase()}/${r.slug}`);
        logger_1.logger.debug({ result }, 'result of getRepos()');
        return result;
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.error({ err }, `bitbucket getRepos error`);
        throw err;
    }
}
exports.getRepos = getRepos;
async function getRawFile(fileName, repoName, branchOrTag) {
    const repo = repoName ?? config.repository;
    const [project, slug] = repo.split('/');
    const fileUrl = `./rest/api/1.0/projects/${project}/repos/${slug}/browse/${fileName}?limit=20000` +
        (branchOrTag ? '&at=' + branchOrTag : '');
    const res = await bitbucketServerHttp.getJson(fileUrl);
    const { isLastPage, lines, size } = res.body;
    if (isLastPage) {
        return lines.map(({ text }) => text).join('');
    }
    const msg = `The file is too big (${size}B)`;
    logger_1.logger.warn({ size }, msg);
    throw new Error(msg);
}
exports.getRawFile = getRawFile;
async function getJsonFile(fileName, repoName, branchOrTag) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const raw = (await getRawFile(fileName, repoName, branchOrTag));
    return json5_1.default.parse(raw);
}
exports.getJsonFile = getJsonFile;
// Initialize BitBucket Server by getting base branch
async function initRepo({ repository, cloneSubmodules, ignorePrAuthor, }) {
    logger_1.logger.debug(`initRepo("${JSON.stringify({ repository }, null, 2)}")`);
    const opts = hostRules.find({
        hostType: defaults.hostType,
        url: defaults.endpoint,
    });
    const [projectKey, repositorySlug] = repository.split('/');
    config = {
        projectKey,
        repositorySlug,
        repository,
        prVersions: new Map(),
        username: opts.username,
        ignorePrAuthor,
    };
    try {
        const info = (await bitbucketServerHttp.getJson(`./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}`)).body;
        config.owner = info.project.key;
        logger_1.logger.debug(`${repository} owner = ${config.owner}`);
        const branchRes = await bitbucketServerHttp.getJson(`./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/branches/default`);
        // 204 means empty, 404 means repo not found or missing default branch. repo must exist here.
        if ([204, 404].includes(branchRes.statusCode)) {
            throw new Error(error_messages_1.REPOSITORY_EMPTY);
        }
        const gitUrl = utils.getRepoGitUrl(config.repositorySlug, 
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        defaults.endpoint, info, opts);
        await git.initRepo({
            ...config,
            url: gitUrl,
            cloneSubmodules,
            fullClone: true,
        });
        config.mergeMethod = 'merge';
        const repoConfig = {
            defaultBranch: branchRes.body.displayId,
            isFork: !!info.origin,
        };
        return repoConfig;
    }
    catch (err) /* istanbul ignore next */ {
        if (err.statusCode === 404) {
            throw new Error(error_messages_1.REPOSITORY_NOT_FOUND);
        }
        if (err.message === error_messages_1.REPOSITORY_EMPTY) {
            throw err;
        }
        logger_1.logger.debug({ err }, 'Unknown Bitbucket initRepo error');
        throw err;
    }
}
exports.initRepo = initRepo;
async function getRepoForceRebase() {
    logger_1.logger.debug(`getRepoForceRebase()`);
    // https://docs.atlassian.com/bitbucket-server/rest/7.0.1/bitbucket-rest.html#idp342
    const res = await bitbucketServerHttp.getJson(`./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/settings/pull-requests`);
    // If the default merge strategy contains `ff-only` the PR can only be merged
    // if it is up to date with the base branch.
    // The current options for id are:
    // no-ff, ff, ff-only, rebase-no-ff, rebase-ff-only, squash, squash-ff-only
    return Boolean(res.body?.mergeConfig?.defaultStrategy?.id.includes('ff-only'));
}
exports.getRepoForceRebase = getRepoForceRebase;
// Gets details for a PR
async function getPr(prNo, refreshCache) {
    logger_1.logger.debug(`getPr(${prNo})`);
    if (!prNo) {
        return null;
    }
    const res = await bitbucketServerHttp.getJson(`./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/pull-requests/${prNo}`, { useCache: !refreshCache });
    const pr = {
        displayNumber: `Pull Request #${res.body.id}`,
        ...utils.prInfo(res.body),
        reviewers: res.body.reviewers.map((r) => r.user.name),
    };
    pr.hasReviewers = is_1.default.nonEmptyArray(pr.reviewers);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    pr.version = updatePrVersion(pr.number, pr.version);
    return pr;
}
exports.getPr = getPr;
// TODO: coverage (#9624)
// istanbul ignore next
function matchesState(state, desiredState) {
    if (desiredState === types_1.PrState.All) {
        return true;
    }
    if (desiredState.startsWith('!')) {
        return state !== desiredState.substring(1);
    }
    return state === desiredState;
}
// TODO: coverage (#9624)
// istanbul ignore next
const isRelevantPr = (branchName, prTitle, state) => (p) => p.sourceBranch === branchName &&
    (!prTitle || p.title === prTitle) &&
    matchesState(p.state, state);
// TODO: coverage (#9624)
async function getPrList(refreshCache) {
    logger_1.logger.debug(`getPrList()`);
    // istanbul ignore next
    if (!config.prList || refreshCache) {
        const searchParams = {
            state: 'ALL',
        };
        if (!config.ignorePrAuthor) {
            searchParams['role.1'] = 'AUTHOR';
            searchParams['username.1'] = config.username;
        }
        const query = (0, url_1.getQueryString)(searchParams);
        const values = await utils.accumulateValues(`./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/pull-requests?${query}`);
        config.prList = values.map(utils.prInfo);
        logger_1.logger.debug({ length: config.prList.length }, 'Retrieved Pull Requests');
    }
    else {
        logger_1.logger.debug('returning cached PR list');
    }
    return config.prList;
}
exports.getPrList = getPrList;
// TODO: coverage (#9624)
// istanbul ignore next
async function findPr({ branchName, prTitle, state = types_1.PrState.All, refreshCache, }) {
    logger_1.logger.debug(`findPr(${branchName}, "${prTitle}", "${state}")`);
    const prList = await getPrList(refreshCache);
    const pr = prList.find(isRelevantPr(branchName, prTitle, state));
    if (pr) {
        logger_1.logger.debug(`Found PR #${pr.number}`);
    }
    else {
        logger_1.logger.debug(`Renovate did not find a PR for branch #${branchName}`);
    }
    return pr ?? null;
}
exports.findPr = findPr;
// Returns the Pull Request for a branch. Null if not exists.
async function getBranchPr(branchName) {
    logger_1.logger.debug(`getBranchPr(${branchName})`);
    const existingPr = await findPr({
        branchName,
        state: types_1.PrState.Open,
    });
    return existingPr ? getPr(existingPr.number) : null;
}
exports.getBranchPr = getBranchPr;
// istanbul ignore next
async function refreshPr(number) {
    // wait for pr change propagation
    await (0, delay_1.default)(1000);
    // refresh cache
    await getPr(number, true);
}
exports.refreshPr = refreshPr;
async function getStatus(branchName, useCache = true) {
    const branchCommit = git.getBranchCommit(branchName);
    return (await bitbucketServerHttp.getJson(`./rest/build-status/1.0/commits/stats/${branchCommit}`, {
        useCache,
    })).body;
}
// Returns the combined status for a branch.
// umbrella for status checks
// https://docs.atlassian.com/bitbucket-server/rest/6.0.0/bitbucket-build-rest.html#idp2
async function getBranchStatus(branchName) {
    logger_1.logger.debug(`getBranchStatus(${branchName})`);
    if (!git.branchExists(branchName)) {
        logger_1.logger.debug('Branch does not exist - cannot fetch status');
        throw new Error(error_messages_1.REPOSITORY_CHANGED);
    }
    try {
        const commitStatus = await getStatus(branchName);
        logger_1.logger.debug({ commitStatus }, 'branch status check result');
        if (commitStatus.failed > 0) {
            return types_1.BranchStatus.red;
        }
        if (commitStatus.inProgress > 0) {
            return types_1.BranchStatus.yellow;
        }
        return commitStatus.successful > 0
            ? types_1.BranchStatus.green
            : types_1.BranchStatus.yellow;
    }
    catch (err) {
        logger_1.logger.warn({ err }, `Failed to get branch status`);
        return types_1.BranchStatus.red;
    }
}
exports.getBranchStatus = getBranchStatus;
function getStatusCheck(branchName, useCache = true) {
    const branchCommit = git.getBranchCommit(branchName);
    return utils.accumulateValues(`./rest/build-status/1.0/commits/${branchCommit}`, 'get', { useCache });
}
// https://docs.atlassian.com/bitbucket-server/rest/6.0.0/bitbucket-build-rest.html#idp2
async function getBranchStatusCheck(branchName, context) {
    logger_1.logger.debug(`getBranchStatusCheck(${branchName}, context=${context})`);
    try {
        const states = await getStatusCheck(branchName);
        for (const state of states) {
            if (state.key === context) {
                switch (state.state) {
                    case 'SUCCESSFUL':
                        return types_1.BranchStatus.green;
                    case 'INPROGRESS':
                        return types_1.BranchStatus.yellow;
                    case 'FAILED':
                    default:
                        return types_1.BranchStatus.red;
                }
            }
        }
    }
    catch (err) {
        logger_1.logger.warn({ err }, `Failed to check branch status`);
    }
    return null;
}
exports.getBranchStatusCheck = getBranchStatusCheck;
async function setBranchStatus({ branchName, context, description, state, url: targetUrl, }) {
    logger_1.logger.debug(`setBranchStatus(${branchName})`);
    const existingStatus = await getBranchStatusCheck(branchName, context);
    if (existingStatus === state) {
        return;
    }
    logger_1.logger.debug({ branch: branchName, context, state }, 'Setting branch status');
    const branchCommit = git.getBranchCommit(branchName);
    try {
        const body = {
            key: context,
            description,
            url: targetUrl || 'https://renovatebot.com',
        };
        switch (state) {
            case types_1.BranchStatus.green:
                body.state = 'SUCCESSFUL';
                break;
            case types_1.BranchStatus.yellow:
                body.state = 'INPROGRESS';
                break;
            case types_1.BranchStatus.red:
            default:
                body.state = 'FAILED';
                break;
        }
        await bitbucketServerHttp.postJson(`./rest/build-status/1.0/commits/${branchCommit}`, { body });
        // update status cache
        await getStatus(branchName, false);
        await getStatusCheck(branchName, false);
    }
    catch (err) {
        logger_1.logger.warn({ err }, `Failed to set branch status`);
    }
}
exports.setBranchStatus = setBranchStatus;
// Issue
/* istanbul ignore next */
function findIssue(title) {
    logger_1.logger.debug(`findIssue(${title})`);
    // This is used by Renovate when creating its own issues,
    // e.g. for deprecated package warnings,
    // config error notifications, or "dependencyDashboard"
    //
    // Bitbucket Server does not have issues
    return Promise.resolve(null);
}
exports.findIssue = findIssue;
/* istanbul ignore next */
function ensureIssue({ title, }) {
    logger_1.logger.warn({ title }, 'Cannot ensure issue');
    // This is used by Renovate when creating its own issues,
    // e.g. for deprecated package warnings,
    // config error notifications, or "dependencyDashboard"
    //
    // Bitbucket Server does not have issues
    return Promise.resolve(null);
}
exports.ensureIssue = ensureIssue;
/* istanbul ignore next */
function getIssueList() {
    logger_1.logger.debug(`getIssueList()`);
    // This is used by Renovate when creating its own issues,
    // e.g. for deprecated package warnings,
    // config error notifications, or "dependencyDashboard"
    //
    // Bitbucket Server does not have issues
    return Promise.resolve([]);
}
exports.getIssueList = getIssueList;
/* istanbul ignore next */
function ensureIssueClosing(title) {
    logger_1.logger.debug(`ensureIssueClosing(${title})`);
    // This is used by Renovate when creating its own issues,
    // e.g. for deprecated package warnings,
    // config error notifications, or "dependencyDashboard"
    //
    // Bitbucket Server does not have issues
    return Promise.resolve();
}
exports.ensureIssueClosing = ensureIssueClosing;
function addAssignees(iid, assignees) {
    logger_1.logger.debug(`addAssignees(${iid}, [${assignees.join(', ')}])`);
    // This is used by Renovate when creating its own issues,
    // e.g. for deprecated package warnings,
    // config error notifications, or "dependencyDashboard"
    //
    // Bitbucket Server does not have issues
    return Promise.resolve();
}
exports.addAssignees = addAssignees;
async function addReviewers(prNo, reviewers) {
    logger_1.logger.debug(`Adding reviewers '${reviewers.join(', ')}' to #${prNo}`);
    try {
        const pr = await getPr(prNo);
        if (!pr) {
            throw new Error(error_messages_1.REPOSITORY_NOT_FOUND);
        }
        // TODO: can `reviewers` be undefined?
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        const reviewersSet = new Set([...pr.reviewers, ...reviewers]);
        await bitbucketServerHttp.putJson(`./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/pull-requests/${prNo}`, {
            body: {
                title: pr.title,
                version: pr.version,
                reviewers: Array.from(reviewersSet).map((name) => ({
                    user: { name },
                })),
            },
        });
        await getPr(prNo, true);
    }
    catch (err) {
        logger_1.logger.warn({ err, reviewers, prNo }, `Failed to add reviewers`);
        if (err.statusCode === 404) {
            throw new Error(error_messages_1.REPOSITORY_NOT_FOUND);
        }
        else if (err.statusCode === 409 &&
            !utils.isInvalidReviewersResponse(err)) {
            logger_1.logger.debug('409 response to adding reviewers - has repository changed?');
            throw new Error(error_messages_1.REPOSITORY_CHANGED);
        }
        else {
            throw err;
        }
    }
}
exports.addReviewers = addReviewers;
function deleteLabel(issueNo, label) {
    logger_1.logger.debug(`deleteLabel(${issueNo}, ${label})`);
    // Only used for the "request Renovate to rebase a PR using a label" feature
    //
    // Bitbucket Server does not have issues
    return Promise.resolve();
}
exports.deleteLabel = deleteLabel;
async function getComments(prNo) {
    // GET /rest/api/1.0/projects/{projectKey}/repos/{repositorySlug}/pull-requests/{pullRequestId}/activities
    let comments = await utils.accumulateValues(`./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/pull-requests/${prNo}/activities`);
    comments = comments
        .filter((a) => a.action === 'COMMENTED' && a.commentAction === 'ADDED')
        .map((a) => a.comment);
    logger_1.logger.debug(`Found ${comments.length} comments`);
    return comments;
}
async function addComment(prNo, text) {
    // POST /rest/api/1.0/projects/{projectKey}/repos/{repositorySlug}/pull-requests/{pullRequestId}/comments
    await bitbucketServerHttp.postJson(`./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/pull-requests/${prNo}/comments`, {
        body: { text },
    });
}
async function getCommentVersion(prNo, commentId) {
    // GET /rest/api/1.0/projects/{projectKey}/repos/{repositorySlug}/pull-requests/{pullRequestId}/comments/{commentId}
    const { version } = (await bitbucketServerHttp.getJson(`./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/pull-requests/${prNo}/comments/${commentId}`)).body;
    return version;
}
async function editComment(prNo, commentId, text) {
    const version = await getCommentVersion(prNo, commentId);
    // PUT /rest/api/1.0/projects/{projectKey}/repos/{repositorySlug}/pull-requests/{pullRequestId}/comments/{commentId}
    await bitbucketServerHttp.putJson(`./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/pull-requests/${prNo}/comments/${commentId}`, {
        body: { text, version },
    });
}
async function deleteComment(prNo, commentId) {
    const version = await getCommentVersion(prNo, commentId);
    // DELETE /rest/api/1.0/projects/{projectKey}/repos/{repositorySlug}/pull-requests/{pullRequestId}/comments/{commentId}
    await bitbucketServerHttp.deleteJson(`./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/pull-requests/${prNo}/comments/${commentId}?version=${version}`);
}
async function ensureComment({ number, topic, content, }) {
    const sanitizedContent = (0, sanitize_1.sanitize)(content);
    try {
        const comments = await getComments(number);
        let body;
        let commentId;
        let commentNeedsUpdating;
        if (topic) {
            logger_1.logger.debug(`Ensuring comment "${topic}" in #${number}`);
            body = `### ${topic}\n\n${sanitizedContent}`;
            comments.forEach((comment) => {
                if (comment.text.startsWith(`### ${topic}\n\n`)) {
                    commentId = comment.id;
                    commentNeedsUpdating = comment.text !== body;
                }
            });
        }
        else {
            logger_1.logger.debug(`Ensuring content-only comment in #${number}`);
            body = `${sanitizedContent}`;
            comments.forEach((comment) => {
                if (comment.text === body) {
                    commentId = comment.id;
                    commentNeedsUpdating = false;
                }
            });
        }
        if (!commentId) {
            await addComment(number, body);
            logger_1.logger.info({ repository: config.repository, prNo: number, topic }, 'Comment added');
        }
        else if (commentNeedsUpdating) {
            await editComment(number, commentId, body);
            logger_1.logger.debug({ repository: config.repository, prNo: number }, 'Comment updated');
        }
        else {
            logger_1.logger.debug('Comment is already update-to-date');
        }
        return true;
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.warn({ err }, 'Error ensuring comment');
        return false;
    }
}
exports.ensureComment = ensureComment;
async function ensureCommentRemoval(deleteConfig) {
    try {
        const { number: prNo } = deleteConfig;
        const key = deleteConfig.type === 'by-topic'
            ? deleteConfig.topic
            : deleteConfig.content;
        logger_1.logger.debug(`Ensuring comment "${key}" in #${prNo} is removed`);
        const comments = await getComments(prNo);
        let commentId = null;
        if (deleteConfig.type === 'by-topic') {
            const byTopic = (comment) => comment.text.startsWith(`### ${deleteConfig.topic}\n\n`);
            commentId = comments.find(byTopic)?.id;
        }
        else if (deleteConfig.type === 'by-content') {
            const byContent = (comment) => comment.text.trim() === deleteConfig.content;
            commentId = comments.find(byContent)?.id;
        }
        if (commentId) {
            await deleteComment(prNo, commentId);
        }
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.warn({ err }, 'Error ensuring comment removal');
    }
}
exports.ensureCommentRemoval = ensureCommentRemoval;
// Pull Request
const escapeHash = (input) => input?.replace((0, regex_1.regEx)(/#/g), '%23');
async function createPr({ sourceBranch, targetBranch, prTitle: title, prBody: rawDescription, platformOptions, }) {
    const description = (0, sanitize_1.sanitize)(rawDescription);
    logger_1.logger.debug(`createPr(${sourceBranch}, title=${title})`);
    const base = targetBranch;
    let reviewers = [];
    /* istanbul ignore else */
    if (platformOptions?.bbUseDefaultReviewers) {
        logger_1.logger.debug(`fetching default reviewers`);
        const { id } = (await bitbucketServerHttp.getJson(`./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}`)).body;
        const defReviewers = (await bitbucketServerHttp.getJson(`./rest/default-reviewers/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/reviewers?sourceRefId=refs/heads/${escapeHash(sourceBranch)}&targetRefId=refs/heads/${base}&sourceRepoId=${id}&targetRepoId=${id}`)).body;
        reviewers = defReviewers.map((u) => ({
            user: { name: u.name },
        }));
    }
    const body = {
        title,
        description,
        fromRef: {
            id: `refs/heads/${sourceBranch}`,
        },
        toRef: {
            id: `refs/heads/${base}`,
        },
        reviewers,
    };
    let prInfoRes;
    try {
        prInfoRes = await bitbucketServerHttp.postJson(`./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/pull-requests`, { body });
    }
    catch (err) /* istanbul ignore next */ {
        if (err.body?.errors?.[0]?.exceptionName ===
            'com.atlassian.bitbucket.pull.EmptyPullRequestException') {
            logger_1.logger.debug('Empty pull request - deleting branch so it can be recreated next run');
            await (0, git_1.deleteBranch)(sourceBranch);
            throw new Error(error_messages_1.REPOSITORY_CHANGED);
        }
        throw err;
    }
    const pr = {
        displayNumber: `Pull Request #${prInfoRes.body.id}`,
        ...utils.prInfo(prInfoRes.body),
    };
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    updatePrVersion(pr.number, pr.version);
    // istanbul ignore if
    if (config.prList) {
        config.prList.push(pr);
    }
    return pr;
}
exports.createPr = createPr;
async function updatePr({ number: prNo, prTitle: title, prBody: rawDescription, state, bitbucketInvalidReviewers, }) {
    const description = (0, sanitize_1.sanitize)(rawDescription);
    logger_1.logger.debug(`updatePr(${prNo}, title=${title})`);
    try {
        const pr = await getPr(prNo);
        if (!pr) {
            throw Object.assign(new Error(error_messages_1.REPOSITORY_NOT_FOUND), { statusCode: 404 });
        }
        const { body: updatedPr } = await bitbucketServerHttp.putJson(`./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/pull-requests/${prNo}`, {
            body: {
                title,
                description,
                version: pr.version,
                reviewers: pr.reviewers
                    ?.filter((name) => !bitbucketInvalidReviewers?.includes(name))
                    .map((name) => ({ user: { name } })),
            },
        });
        updatePrVersion(prNo, updatedPr.version);
        const currentState = updatedPr.state;
        const newState = {
            [types_1.PrState.Open]: 'OPEN',
            [types_1.PrState.Closed]: 'DECLINED',
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        }[state];
        if (newState &&
            ['OPEN', 'DECLINED'].includes(currentState) &&
            currentState !== newState) {
            const command = state === types_1.PrState.Open ? 'reopen' : 'decline';
            const { body: updatedStatePr } = await bitbucketServerHttp.postJson(`./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/pull-requests/${pr.number}/${command}?version=${updatedPr.version}`);
            updatePrVersion(pr.number, updatedStatePr.version);
        }
    }
    catch (err) {
        logger_1.logger.debug({ err, prNo }, `Failed to update PR`);
        if (err.statusCode === 404) {
            throw new Error(error_messages_1.REPOSITORY_NOT_FOUND);
        }
        else if (err.statusCode === 409) {
            if (utils.isInvalidReviewersResponse(err) && !bitbucketInvalidReviewers) {
                // Retry again with invalid reviewers being removed
                const invalidReviewers = utils.getInvalidReviewers(err);
                await updatePr({
                    number: prNo,
                    prTitle: title,
                    prBody: rawDescription,
                    state,
                    bitbucketInvalidReviewers: invalidReviewers,
                });
            }
            else {
                throw new Error(error_messages_1.REPOSITORY_CHANGED);
            }
        }
        else {
            throw err;
        }
    }
}
exports.updatePr = updatePr;
// https://docs.atlassian.com/bitbucket-server/rest/6.0.0/bitbucket-rest.html#idp261
async function mergePr({ branchName, id: prNo, }) {
    logger_1.logger.debug(`mergePr(${prNo}, ${branchName})`);
    // Used for "automerge" feature
    try {
        const pr = await getPr(prNo);
        if (!pr) {
            throw Object.assign(new Error(error_messages_1.REPOSITORY_NOT_FOUND), { statusCode: 404 });
        }
        const { body } = await bitbucketServerHttp.postJson(`./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/pull-requests/${prNo}/merge?version=${pr.version}`);
        updatePrVersion(prNo, body.version);
    }
    catch (err) {
        if (err.statusCode === 404) {
            throw new Error(error_messages_1.REPOSITORY_NOT_FOUND);
        }
        else if (err.statusCode === 409) {
            logger_1.logger.warn({ err }, `Failed to merge PR`);
            return false;
        }
        else {
            logger_1.logger.warn({ err }, `Failed to merge PR`);
            return false;
        }
    }
    logger_1.logger.debug({ pr: prNo }, 'PR merged');
    return true;
}
exports.mergePr = mergePr;
function massageMarkdown(input) {
    logger_1.logger.debug(`massageMarkdown(${input.split(regex_1.newlineRegex)[0]})`);
    // Remove any HTML we use
    return (0, pr_body_1.smartTruncate)(input, 30000)
        .replace('you tick the rebase/retry checkbox', 'rename PR to start with "rebase!"')
        .replace((0, regex_1.regEx)(/<\/?summary>/g), '**')
        .replace((0, regex_1.regEx)(/<\/?details>/g), '')
        .replace((0, regex_1.regEx)(`\n---\n\n.*?<!-- rebase-check -->.*?(\n|$)`), '')
        .replace((0, regex_1.regEx)('<!--.*?-->', 'g'), '');
}
exports.massageMarkdown = massageMarkdown;
function getVulnerabilityAlerts() {
    logger_1.logger.debug(`getVulnerabilityAlerts()`);
    return Promise.resolve([]);
}
exports.getVulnerabilityAlerts = getVulnerabilityAlerts;
//# sourceMappingURL=index.js.map