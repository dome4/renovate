"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterUnavailableUsers = exports.getVulnerabilityAlerts = exports.ensureCommentRemoval = exports.ensureComment = exports.deleteLabel = exports.addReviewers = exports.addAssignees = exports.ensureIssueClosing = exports.ensureIssue = exports.findIssue = exports.getIssue = exports.getIssueList = exports.setBranchStatus = exports.getBranchStatusCheck = exports.getBranchPr = exports.findPr = exports.massageMarkdown = exports.mergePr = exports.updatePr = exports.getPr = exports.createPr = exports.getPrList = exports.getBranchStatus = exports.getRepoForceRebase = exports.initRepo = exports.getJsonFile = exports.getRawFile = exports.getRepos = exports.initPlatform = void 0;
const tslib_1 = require("tslib");
const url_1 = tslib_1.__importDefault(require("url"));
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const delay_1 = tslib_1.__importDefault(require("delay"));
const json5_1 = tslib_1.__importDefault(require("json5"));
const p_all_1 = tslib_1.__importDefault(require("p-all"));
const semver_1 = tslib_1.__importDefault(require("semver"));
const constants_1 = require("../../../constants");
const error_messages_1 = require("../../../constants/error-messages");
const logger_1 = require("../../../logger");
const types_1 = require("../../../types");
const git = tslib_1.__importStar(require("../../../util/git"));
const hostRules = tslib_1.__importStar(require("../../../util/host-rules"));
const gitlab_1 = require("../../../util/http/gitlab");
const regex_1 = require("../../../util/regex");
const sanitize_1 = require("../../../util/sanitize");
const url_2 = require("../../../util/url");
const pr_body_1 = require("../pr-body");
const pr_body_2 = require("../utils/pr-body");
const http_1 = require("./http");
const merge_request_1 = require("./merge-request");
let config = {};
const defaults = {
    hostType: constants_1.PlatformId.Gitlab,
    endpoint: 'https://gitlab.com/api/v4/',
    version: '0.0.0',
};
const DRAFT_PREFIX = 'Draft: ';
const DRAFT_PREFIX_DEPRECATED = 'WIP: ';
let draftPrefix = DRAFT_PREFIX;
async function initPlatform({ endpoint, token, gitAuthor, }) {
    if (!token) {
        throw new Error('Init: You must configure a GitLab personal access token');
    }
    if (endpoint) {
        defaults.endpoint = (0, url_2.ensureTrailingSlash)(endpoint);
        (0, gitlab_1.setBaseUrl)(defaults.endpoint);
    }
    else {
        logger_1.logger.debug('Using default GitLab endpoint: ' + defaults.endpoint);
    }
    const platformConfig = {
        endpoint: defaults.endpoint,
    };
    let gitlabVersion;
    try {
        if (!gitAuthor) {
            const user = (await http_1.gitlabApi.getJson(`user`, { token })).body;
            platformConfig.gitAuthor = `${user.name} <${user.email}>`;
        }
        // istanbul ignore if: experimental feature
        if (process.env.RENOVATE_X_PLATFORM_VERSION) {
            gitlabVersion = process.env.RENOVATE_X_PLATFORM_VERSION;
        }
        else {
            const version = (await http_1.gitlabApi.getJson('version', { token })).body;
            gitlabVersion = version.version;
        }
        logger_1.logger.debug('GitLab version is: ' + gitlabVersion);
        // version is 'x.y.z-edition', so not strictly semver; need to strip edition
        [gitlabVersion] = gitlabVersion.split('-');
        defaults.version = gitlabVersion;
    }
    catch (err) {
        logger_1.logger.debug({ err }, 'Error authenticating with GitLab. Check that your token includes "api" permissions');
        throw new Error('Init: Authentication failure');
    }
    draftPrefix = semver_1.default.lt(defaults.version, '13.2.0')
        ? DRAFT_PREFIX_DEPRECATED
        : DRAFT_PREFIX;
    return platformConfig;
}
exports.initPlatform = initPlatform;
// Get all repositories that the user has access to
async function getRepos() {
    logger_1.logger.debug('Autodiscovering GitLab repositories');
    try {
        const url = `projects?membership=true&per_page=100&with_merge_requests_enabled=true&min_access_level=30`;
        const res = await http_1.gitlabApi.getJson(url, {
            paginate: true,
        });
        logger_1.logger.debug(`Discovered ${res.body.length} project(s)`);
        return res.body
            .filter((repo) => !repo.mirror && !repo.archived)
            .map((repo) => repo.path_with_namespace);
    }
    catch (err) {
        logger_1.logger.error({ err }, `GitLab getRepos error`);
        throw err;
    }
}
exports.getRepos = getRepos;
function urlEscape(str) {
    return str ? str.replace((0, regex_1.regEx)(/\//g), '%2F') : str;
}
async function getRawFile(fileName, repoName, branchOrTag) {
    const escapedFileName = urlEscape(fileName);
    const repo = urlEscape(repoName ?? config.repository);
    const url = `projects/${repo}/repository/files/${escapedFileName}?ref=` +
        (branchOrTag || `HEAD`);
    const res = await http_1.gitlabApi.getJson(url);
    const buf = res.body.content;
    const str = Buffer.from(buf, 'base64').toString();
    return str;
}
exports.getRawFile = getRawFile;
async function getJsonFile(fileName, repoName, branchOrTag) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const raw = (await getRawFile(fileName, repoName, branchOrTag));
    return json5_1.default.parse(raw);
}
exports.getJsonFile = getJsonFile;
function getRepoUrl(repository, gitUrl, res) {
    if (gitUrl === 'ssh') {
        if (!res.body.ssh_url_to_repo) {
            throw new Error(error_messages_1.CONFIG_GIT_URL_UNAVAILABLE);
        }
        logger_1.logger.debug({ url: res.body.ssh_url_to_repo }, `using ssh URL`);
        return res.body.ssh_url_to_repo;
    }
    const opts = hostRules.find({
        hostType: defaults.hostType,
        url: defaults.endpoint,
    });
    if (gitUrl === 'endpoint' ||
        process.env.GITLAB_IGNORE_REPO_URL ||
        res.body.http_url_to_repo === null) {
        if (res.body.http_url_to_repo === null) {
            logger_1.logger.debug('no http_url_to_repo found. Falling back to old behaviour.');
        }
        if (process.env.GITLAB_IGNORE_REPO_URL) {
            logger_1.logger.warn('GITLAB_IGNORE_REPO_URL environment variable is deprecated. Please use "gitUrl" option.');
        }
        // TODO: null check #7154
        const { protocol, host, pathname } = (0, url_2.parseUrl)(defaults.endpoint);
        const newPathname = pathname.slice(0, pathname.indexOf('/api'));
        const url = url_1.default.format({
            protocol: protocol.slice(0, -1) || 'https',
            auth: 'oauth2:' + opts.token,
            host,
            pathname: newPathname + '/' + repository + '.git',
        });
        logger_1.logger.debug({ url }, 'using URL based on configured endpoint');
        return url;
    }
    logger_1.logger.debug({ url: res.body.http_url_to_repo }, `using http URL`);
    const repoUrl = url_1.default.parse(`${res.body.http_url_to_repo}`);
    repoUrl.auth = 'oauth2:' + opts.token;
    return url_1.default.format(repoUrl);
}
// Initialize GitLab by getting base branch
async function initRepo({ repository, cloneSubmodules, ignorePrAuthor, gitUrl, }) {
    config = {};
    config.repository = urlEscape(repository);
    config.cloneSubmodules = cloneSubmodules;
    config.ignorePrAuthor = ignorePrAuthor;
    let res;
    try {
        res = await http_1.gitlabApi.getJson(`projects/${config.repository}`);
        if (res.body.archived) {
            logger_1.logger.debug('Repository is archived - throwing error to abort renovation');
            throw new Error(error_messages_1.REPOSITORY_ARCHIVED);
        }
        if (res.body.mirror) {
            logger_1.logger.debug('Repository is a mirror - throwing error to abort renovation');
            throw new Error(error_messages_1.REPOSITORY_MIRRORED);
        }
        if (res.body.repository_access_level === 'disabled') {
            logger_1.logger.debug('Repository portion of project is disabled - throwing error to abort renovation');
            throw new Error(error_messages_1.REPOSITORY_DISABLED);
        }
        if (res.body.merge_requests_access_level === 'disabled') {
            logger_1.logger.debug('MRs are disabled for the project - throwing error to abort renovation');
            throw new Error(error_messages_1.REPOSITORY_DISABLED);
        }
        if (res.body.default_branch === null || res.body.empty_repo) {
            throw new Error(error_messages_1.REPOSITORY_EMPTY);
        }
        config.defaultBranch = res.body.default_branch;
        // istanbul ignore if
        if (!config.defaultBranch) {
            logger_1.logger.warn({ resBody: res.body }, 'Error fetching GitLab project');
            throw new Error(error_messages_1.TEMPORARY_ERROR);
        }
        config.mergeMethod = res.body.merge_method || 'merge';
        if (res.body.squash_option) {
            config.squash =
                res.body.squash_option === 'always' ||
                    res.body.squash_option === 'default_on';
        }
        logger_1.logger.debug(`${repository} default branch = ${config.defaultBranch}`);
        delete config.prList;
        logger_1.logger.debug('Enabling Git FS');
        const url = getRepoUrl(repository, gitUrl, res);
        await git.initRepo({
            ...config,
            url,
        });
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.debug({ err }, 'Caught initRepo error');
        if (err.message.includes('HEAD is not a symbolic ref')) {
            throw new Error(error_messages_1.REPOSITORY_EMPTY);
        }
        if ([error_messages_1.REPOSITORY_ARCHIVED, error_messages_1.REPOSITORY_EMPTY].includes(err.message)) {
            throw err;
        }
        if (err.statusCode === 403) {
            throw new Error(error_messages_1.REPOSITORY_ACCESS_FORBIDDEN);
        }
        if (err.statusCode === 404) {
            throw new Error(error_messages_1.REPOSITORY_NOT_FOUND);
        }
        if (err.message === error_messages_1.REPOSITORY_DISABLED) {
            throw err;
        }
        logger_1.logger.debug({ err }, 'Unknown GitLab initRepo error');
        throw err;
    }
    const repoConfig = {
        defaultBranch: config.defaultBranch,
        isFork: !!res.body.forked_from_project,
    };
    return repoConfig;
}
exports.initRepo = initRepo;
function getRepoForceRebase() {
    return Promise.resolve(config?.mergeMethod !== 'merge');
}
exports.getRepoForceRebase = getRepoForceRebase;
async function getStatus(branchName, useCache = true) {
    const branchSha = git.getBranchCommit(branchName);
    try {
        const url = `projects/${config.repository}/repository/commits/${branchSha}/statuses`;
        return (await http_1.gitlabApi.getJson(url, {
            paginate: true,
            useCache,
        })).body;
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.debug({ err }, 'Error getting commit status');
        if (err.response?.statusCode === 404) {
            throw new Error(error_messages_1.REPOSITORY_CHANGED);
        }
        throw err;
    }
}
const gitlabToRenovateStatusMapping = {
    pending: types_1.BranchStatus.yellow,
    created: types_1.BranchStatus.yellow,
    manual: types_1.BranchStatus.yellow,
    running: types_1.BranchStatus.yellow,
    waiting_for_resource: types_1.BranchStatus.yellow,
    success: types_1.BranchStatus.green,
    failed: types_1.BranchStatus.red,
    canceled: types_1.BranchStatus.red,
    skipped: types_1.BranchStatus.red,
    scheduled: types_1.BranchStatus.yellow,
};
// Returns the combined status for a branch.
async function getBranchStatus(branchName) {
    logger_1.logger.debug(`getBranchStatus(${branchName})`);
    if (!git.branchExists(branchName)) {
        throw new Error(error_messages_1.REPOSITORY_CHANGED);
    }
    const branchStatuses = await getStatus(branchName);
    // istanbul ignore if
    if (!is_1.default.array(branchStatuses)) {
        logger_1.logger.warn({ branchName, branchStatuses }, 'Empty or unexpected branch statuses');
        return types_1.BranchStatus.yellow;
    }
    logger_1.logger.debug(`Got res with ${branchStatuses.length} results`);
    // ignore all skipped jobs
    const res = branchStatuses.filter((check) => check.status !== 'skipped');
    if (res.length === 0) {
        // Return 'pending' if we have no status checks
        return types_1.BranchStatus.yellow;
    }
    let status = types_1.BranchStatus.green; // default to green
    res
        .filter((check) => !check.allow_failure)
        .forEach((check) => {
        if (status !== types_1.BranchStatus.red) {
            // if red, stay red
            let mappedStatus = gitlabToRenovateStatusMapping[check.status];
            if (!mappedStatus) {
                logger_1.logger.warn({ check }, 'Could not map GitLab check.status to Renovate status');
                mappedStatus = types_1.BranchStatus.yellow;
            }
            if (mappedStatus !== types_1.BranchStatus.green) {
                logger_1.logger.trace({ check }, 'Found non-green check');
                status = mappedStatus;
            }
        }
    });
    return status;
}
exports.getBranchStatus = getBranchStatus;
// Pull Request
function massagePr(prToModify) {
    const pr = prToModify;
    if (pr.title.startsWith(DRAFT_PREFIX)) {
        pr.title = pr.title.substring(DRAFT_PREFIX.length);
        pr.isDraft = true;
    }
    else if (pr.title.startsWith(DRAFT_PREFIX_DEPRECATED)) {
        pr.title = pr.title.substring(DRAFT_PREFIX_DEPRECATED.length);
        pr.isDraft = true;
    }
    return pr;
}
async function fetchPrList() {
    const searchParams = {
        per_page: '100',
    };
    // istanbul ignore if
    if (!config.ignorePrAuthor) {
        searchParams.scope = 'created_by_me';
    }
    const query = (0, url_2.getQueryString)(searchParams);
    const urlString = `projects/${config.repository}/merge_requests?${query}`;
    try {
        const res = await http_1.gitlabApi.getJson(urlString, { paginate: true });
        return res.body.map((pr) => massagePr({
            number: pr.iid,
            sourceBranch: pr.source_branch,
            title: pr.title,
            state: pr.state === 'opened' ? types_1.PrState.Open : pr.state,
            createdAt: pr.created_at,
        }));
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.debug({ err }, 'Error fetching PR list');
        if (err.statusCode === 403) {
            throw new Error(error_messages_1.PLATFORM_AUTHENTICATION_ERROR);
        }
        throw err;
    }
}
async function getPrList() {
    if (!config.prList) {
        config.prList = await fetchPrList();
    }
    return config.prList;
}
exports.getPrList = getPrList;
async function ignoreApprovals(pr) {
    try {
        const url = `projects/${config.repository}/merge_requests/${pr}/approval_rules`;
        const { body: rules } = await http_1.gitlabApi.getJson(url);
        const ruleName = 'renovateIgnoreApprovals';
        const zeroApproversRule = rules?.find(({ name }) => name === ruleName);
        if (!zeroApproversRule) {
            await http_1.gitlabApi.postJson(url, {
                body: {
                    name: ruleName,
                    approvals_required: 0,
                },
            });
        }
    }
    catch (err) {
        logger_1.logger.warn({ err }, 'GitLab: Error adding approval rule');
    }
}
async function tryPrAutomerge(pr, platformOptions) {
    if (platformOptions?.usePlatformAutomerge) {
        try {
            if (platformOptions?.gitLabIgnoreApprovals) {
                await ignoreApprovals(pr);
            }
            const desiredStatus = 'can_be_merged';
            const retryTimes = 5;
            // Check for correct merge request status before setting `merge_when_pipeline_succeeds` to  `true`.
            for (let attempt = 1; attempt <= retryTimes; attempt += 1) {
                const { body } = await http_1.gitlabApi.getJson(`projects/${config.repository}/merge_requests/${pr}`);
                // Only continue if the merge request can be merged and has a pipeline.
                if (body.merge_status === desiredStatus && body.pipeline !== null) {
                    break;
                }
                await (0, delay_1.default)(500 * attempt);
            }
            await http_1.gitlabApi.putJson(`projects/${config.repository}/merge_requests/${pr}/merge`, {
                body: {
                    should_remove_source_branch: true,
                    merge_when_pipeline_succeeds: true,
                },
            });
        }
        catch (err) /* istanbul ignore next */ {
            logger_1.logger.debug({ err }, 'Automerge on PR creation failed');
        }
    }
}
async function createPr({ sourceBranch, targetBranch, prTitle, prBody: rawDescription, draftPR, labels, platformOptions, }) {
    let title = prTitle;
    if (draftPR) {
        title = draftPrefix + title;
    }
    const description = (0, sanitize_1.sanitize)(rawDescription);
    logger_1.logger.debug(`Creating Merge Request: ${title}`);
    const res = await http_1.gitlabApi.postJson(`projects/${config.repository}/merge_requests`, {
        body: {
            source_branch: sourceBranch,
            target_branch: targetBranch,
            remove_source_branch: true,
            title,
            description,
            labels: (labels || []).join(','),
            squash: config.squash,
        },
    });
    const pr = res.body;
    pr.number = pr.iid;
    pr.sourceBranch = sourceBranch;
    pr.displayNumber = `Merge Request #${pr.iid}`;
    // istanbul ignore if
    if (config.prList) {
        config.prList.push(pr);
    }
    await tryPrAutomerge(pr.iid, platformOptions);
    return massagePr(pr);
}
exports.createPr = createPr;
async function getPr(iid) {
    logger_1.logger.debug(`getPr(${iid})`);
    const mr = await (0, merge_request_1.getMR)(config.repository, iid);
    // Harmonize fields with GitHub
    const pr = {
        sourceBranch: mr.source_branch,
        targetBranch: mr.target_branch,
        number: mr.iid,
        displayNumber: `Merge Request #${mr.iid}`,
        bodyStruct: (0, pr_body_1.getPrBodyStruct)(mr.description),
        state: mr.state === 'opened' ? types_1.PrState.Open : mr.state,
        hasAssignees: !!(mr.assignee?.id || mr.assignees?.[0]?.id),
        hasReviewers: !!mr.reviewers?.length,
        title: mr.title,
        labels: mr.labels,
        sha: mr.sha,
    };
    return massagePr(pr);
}
exports.getPr = getPr;
async function updatePr({ number: iid, prTitle, prBody: description, state, platformOptions, }) {
    let title = prTitle;
    if ((await getPrList()).find((pr) => pr.number === iid)?.isDraft) {
        title = draftPrefix + title;
    }
    const newState = {
        [types_1.PrState.Closed]: 'close',
        [types_1.PrState.Open]: 'reopen',
        // TODO: null check #7154
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    }[state];
    await http_1.gitlabApi.putJson(`projects/${config.repository}/merge_requests/${iid}`, {
        body: {
            title,
            description: (0, sanitize_1.sanitize)(description),
            ...(newState && { state_event: newState }),
        },
    });
    await tryPrAutomerge(iid, platformOptions);
}
exports.updatePr = updatePr;
async function mergePr({ id }) {
    try {
        await http_1.gitlabApi.putJson(`projects/${config.repository}/merge_requests/${id}/merge`, {
            body: {
                should_remove_source_branch: true,
            },
        });
        return true;
    }
    catch (err) /* istanbul ignore next */ {
        if (err.statusCode === 401) {
            logger_1.logger.debug('No permissions to merge PR');
            return false;
        }
        if (err.statusCode === 406) {
            logger_1.logger.debug({ err }, 'PR not acceptable for merging');
            return false;
        }
        logger_1.logger.debug({ err }, 'merge PR error');
        logger_1.logger.debug('PR merge failed');
        return false;
    }
}
exports.mergePr = mergePr;
function massageMarkdown(input) {
    let desc = input
        .replace((0, regex_1.regEx)(/Pull Request/g), 'Merge Request')
        .replace((0, regex_1.regEx)(/PR/g), 'MR')
        .replace((0, regex_1.regEx)(/\]\(\.\.\/pull\//g), '](!');
    if (semver_1.default.lt(defaults.version, '13.4.0')) {
        logger_1.logger.debug({ version: defaults.version }, 'GitLab versions earlier than 13.4 have issues with long descriptions, truncating to 25K characters');
        desc = (0, pr_body_2.smartTruncate)(desc, 25000);
    }
    else {
        desc = (0, pr_body_2.smartTruncate)(desc, 1000000);
    }
    return desc;
}
exports.massageMarkdown = massageMarkdown;
// Branch
function matchesState(state, desiredState) {
    if (desiredState === types_1.PrState.All) {
        return true;
    }
    if (desiredState.startsWith('!')) {
        return state !== desiredState.substring(1);
    }
    return state === desiredState;
}
async function findPr({ branchName, prTitle, state = types_1.PrState.All, }) {
    logger_1.logger.debug(`findPr(${branchName}, ${prTitle}, ${state})`);
    const prList = await getPrList();
    return (prList.find((p) => p.sourceBranch === branchName &&
        (!prTitle || p.title === prTitle) &&
        matchesState(p.state, state)) ?? null);
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
async function getBranchStatusCheck(branchName, context) {
    // cache-bust in case we have rebased
    const res = await getStatus(branchName, false);
    logger_1.logger.debug(`Got res with ${res.length} results`);
    for (const check of res) {
        if (check.name === context) {
            return gitlabToRenovateStatusMapping[check.status] || types_1.BranchStatus.yellow;
        }
    }
    return null;
}
exports.getBranchStatusCheck = getBranchStatusCheck;
async function setBranchStatus({ branchName, context, description, state: renovateState, url: targetUrl, }) {
    // First, get the branch commit SHA
    const branchSha = git.getBranchCommit(branchName);
    // Now, check the statuses for that commit
    const url = `projects/${config.repository}/statuses/${branchSha}`;
    let state = 'success';
    if (renovateState === types_1.BranchStatus.yellow) {
        state = 'pending';
    }
    else if (renovateState === types_1.BranchStatus.red) {
        state = 'failed';
    }
    const options = {
        state,
        description,
        context,
    };
    if (targetUrl) {
        options.target_url = targetUrl;
    }
    try {
        // give gitlab some time to create pipelines for the sha
        await (0, delay_1.default)(1000);
        await http_1.gitlabApi.postJson(url, { body: options });
        // update status cache
        await getStatus(branchName, false);
    }
    catch (err) /* istanbul ignore next */ {
        if (err.body?.message?.startsWith('Cannot transition status via :enqueue from :pending')) {
            // https://gitlab.com/gitlab-org/gitlab-foss/issues/25807
            logger_1.logger.debug('Ignoring status transition error');
        }
        else {
            logger_1.logger.debug({ err });
            logger_1.logger.warn('Failed to set branch status');
        }
    }
}
exports.setBranchStatus = setBranchStatus;
// Issue
async function getIssueList() {
    if (!config.issueList) {
        const query = (0, url_2.getQueryString)({
            per_page: '100',
            scope: 'created_by_me',
            state: 'opened',
        });
        const res = await http_1.gitlabApi.getJson(`projects/${config.repository}/issues?${query}`, {
            useCache: false,
            paginate: true,
        });
        // istanbul ignore if
        if (!is_1.default.array(res.body)) {
            logger_1.logger.warn({ responseBody: res.body }, 'Could not retrieve issue list');
            return [];
        }
        config.issueList = res.body.map((i) => ({
            iid: i.iid,
            title: i.title,
            labels: i.labels,
        }));
    }
    return config.issueList;
}
exports.getIssueList = getIssueList;
async function getIssue(number, useCache = true) {
    try {
        const issueBody = (await http_1.gitlabApi.getJson(`projects/${config.repository}/issues/${number}`, { useCache })).body.description;
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
    try {
        const issueList = await getIssueList();
        const issue = issueList.find((i) => i.title === title);
        if (!issue) {
            return null;
        }
        return await getIssue(issue.iid);
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.warn('Error finding issue');
        return null;
    }
}
exports.findIssue = findIssue;
async function ensureIssue({ title, reuseTitle, body, labels, confidential, }) {
    logger_1.logger.debug(`ensureIssue()`);
    const description = massageMarkdown((0, sanitize_1.sanitize)(body));
    try {
        const issueList = await getIssueList();
        let issue = issueList.find((i) => i.title === title);
        if (!issue) {
            issue = issueList.find((i) => i.title === reuseTitle);
        }
        if (issue) {
            const existingDescription = (await http_1.gitlabApi.getJson(`projects/${config.repository}/issues/${issue.iid}`)).body.description;
            if (issue.title !== title || existingDescription !== description) {
                logger_1.logger.debug('Updating issue');
                await http_1.gitlabApi.putJson(`projects/${config.repository}/issues/${issue.iid}`, {
                    body: {
                        title,
                        description,
                        labels: (labels || issue.labels || []).join(','),
                        confidential: confidential ?? false,
                    },
                });
                return 'updated';
            }
        }
        else {
            await http_1.gitlabApi.postJson(`projects/${config.repository}/issues`, {
                body: {
                    title,
                    description,
                    labels: (labels || []).join(','),
                    confidential: confidential ?? false,
                },
            });
            logger_1.logger.info('Issue created');
            // delete issueList so that it will be refetched as necessary
            delete config.issueList;
            return 'created';
        }
    }
    catch (err) /* istanbul ignore next */ {
        if (err.message.startsWith('Issues are disabled for this repo')) {
            logger_1.logger.debug(`Could not create issue: ${err.message}`);
        }
        else {
            logger_1.logger.warn({ err }, 'Could not ensure issue');
        }
    }
    return null;
}
exports.ensureIssue = ensureIssue;
async function ensureIssueClosing(title) {
    logger_1.logger.debug(`ensureIssueClosing()`);
    const issueList = await getIssueList();
    for (const issue of issueList) {
        if (issue.title === title) {
            logger_1.logger.debug({ issue }, 'Closing issue');
            await http_1.gitlabApi.putJson(`projects/${config.repository}/issues/${issue.iid}`, {
                body: { state_event: 'close' },
            });
        }
    }
}
exports.ensureIssueClosing = ensureIssueClosing;
async function addAssignees(iid, assignees) {
    try {
        logger_1.logger.debug(`Adding assignees '${assignees.join(', ')}' to #${iid}`);
        const assigneeIds = [];
        for (const assignee of assignees) {
            assigneeIds.push(await (0, http_1.getUserID)(assignee));
        }
        const url = `projects/${config.repository}/merge_requests/${iid}?${(0, url_2.getQueryString)({
            'assignee_ids[]': assigneeIds,
        })}`;
        await http_1.gitlabApi.putJson(url);
    }
    catch (err) {
        logger_1.logger.debug({ err }, 'addAssignees error');
        logger_1.logger.warn({ iid, assignees }, 'Failed to add assignees');
    }
}
exports.addAssignees = addAssignees;
async function addReviewers(iid, reviewers) {
    logger_1.logger.debug(`Adding reviewers '${reviewers.join(', ')}' to #${iid}`);
    if (semver_1.default.lt(defaults.version, '13.9.0')) {
        logger_1.logger.warn({ version: defaults.version }, 'Adding reviewers is only available in GitLab 13.9 and onwards');
        return;
    }
    let mr;
    try {
        mr = await (0, merge_request_1.getMR)(config.repository, iid);
    }
    catch (err) {
        logger_1.logger.warn({ err }, 'Failed to get existing reviewers');
        return;
    }
    mr.reviewers = mr.reviewers ?? [];
    const existingReviewers = mr.reviewers.map((r) => r.username);
    const existingReviewerIDs = mr.reviewers.map((r) => r.id);
    // Figure out which reviewers (of the ones we want to add) are not already on the MR as a reviewer
    const newReviewers = reviewers.filter((r) => !existingReviewers.includes(r));
    // Gather the IDs for all the reviewers we want to add
    let newReviewerIDs;
    try {
        newReviewerIDs = await (0, p_all_1.default)(newReviewers.map((r) => () => (0, http_1.getUserID)(r)), { concurrency: 5 });
    }
    catch (err) {
        logger_1.logger.warn({ err }, 'Failed to get IDs of the new reviewers');
        return;
    }
    try {
        await (0, merge_request_1.updateMR)(config.repository, iid, {
            reviewer_ids: [...existingReviewerIDs, ...newReviewerIDs],
        });
    }
    catch (err) {
        logger_1.logger.warn({ err }, 'Failed to add reviewers');
    }
}
exports.addReviewers = addReviewers;
async function deleteLabel(issueNo, label) {
    logger_1.logger.debug(`Deleting label ${label} from #${issueNo}`);
    try {
        const pr = await getPr(issueNo);
        const labels = (pr.labels || [])
            .filter((l) => l !== label)
            .join(',');
        await http_1.gitlabApi.putJson(`projects/${config.repository}/merge_requests/${issueNo}`, {
            body: { labels },
        });
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.warn({ err, issueNo, label }, 'Failed to delete label');
    }
}
exports.deleteLabel = deleteLabel;
async function getComments(issueNo) {
    // GET projects/:owner/:repo/merge_requests/:number/notes
    logger_1.logger.debug(`Getting comments for #${issueNo}`);
    const url = `projects/${config.repository}/merge_requests/${issueNo}/notes`;
    const comments = (await http_1.gitlabApi.getJson(url, { paginate: true })).body;
    logger_1.logger.debug(`Found ${comments.length} comments`);
    return comments;
}
async function addComment(issueNo, body) {
    // POST projects/:owner/:repo/merge_requests/:number/notes
    await http_1.gitlabApi.postJson(`projects/${config.repository}/merge_requests/${issueNo}/notes`, {
        body: { body },
    });
}
async function editComment(issueNo, commentId, body) {
    // PUT projects/:owner/:repo/merge_requests/:number/notes/:id
    await http_1.gitlabApi.putJson(`projects/${config.repository}/merge_requests/${issueNo}/notes/${commentId}`, {
        body: { body },
    });
}
async function deleteComment(issueNo, commentId) {
    // DELETE projects/:owner/:repo/merge_requests/:number/notes/:id
    await http_1.gitlabApi.deleteJson(`projects/${config.repository}/merge_requests/${issueNo}/notes/${commentId}`);
}
async function ensureComment({ number, topic, content, }) {
    const sanitizedContent = (0, sanitize_1.sanitize)(content);
    const massagedTopic = topic
        ? topic
            .replace((0, regex_1.regEx)(/Pull Request/g), 'Merge Request')
            .replace((0, regex_1.regEx)(/PR/g), 'MR')
        : topic;
    const comments = await getComments(number);
    let body;
    let commentId;
    let commentNeedsUpdating;
    if (topic) {
        logger_1.logger.debug(`Ensuring comment "${massagedTopic}" in #${number}`);
        body = `### ${topic}\n\n${sanitizedContent}`;
        body = body
            .replace((0, regex_1.regEx)(/Pull Request/g), 'Merge Request')
            .replace((0, regex_1.regEx)(/PR/g), 'MR');
        comments.forEach((comment) => {
            if (comment.body.startsWith(`### ${massagedTopic}\n\n`)) {
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
        logger_1.logger.debug({ repository: config.repository, issueNo: number }, 'Added comment');
    }
    else if (commentNeedsUpdating) {
        await editComment(number, commentId, body);
        logger_1.logger.debug({ repository: config.repository, issueNo: number }, 'Updated comment');
    }
    else {
        logger_1.logger.debug('Comment is already update-to-date');
    }
    return true;
}
exports.ensureComment = ensureComment;
async function ensureCommentRemoval(deleteConfig) {
    const { number: issueNo } = deleteConfig;
    const key = deleteConfig.type === 'by-topic'
        ? deleteConfig.topic
        : deleteConfig.content;
    logger_1.logger.debug(`Ensuring comment "${key}" in #${issueNo} is removed`);
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
    if (commentId) {
        await deleteComment(issueNo, commentId);
    }
}
exports.ensureCommentRemoval = ensureCommentRemoval;
function getVulnerabilityAlerts() {
    return Promise.resolve([]);
}
exports.getVulnerabilityAlerts = getVulnerabilityAlerts;
async function filterUnavailableUsers(users) {
    const filteredUsers = [];
    for (const user of users) {
        if (!(await (0, http_1.isUserBusy)(user))) {
            filteredUsers.push(user);
        }
    }
    return filteredUsers;
}
exports.filterUnavailableUsers = filterUnavailableUsers;
//# sourceMappingURL=index.js.map