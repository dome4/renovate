"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVulnerabilityAlerts = exports.mergePr = exports.updatePr = exports.createPr = exports.ensureCommentRemoval = exports.ensureComment = exports.deleteLabel = exports.addReviewers = exports.addAssignees = exports.ensureIssueClosing = exports.getIssueList = exports.ensureIssue = exports.massageMarkdown = exports.findIssue = exports.setBranchStatus = exports.getBranchStatusCheck = exports.getBranchStatus = exports.getBranchPr = exports.getPr = exports.findPr = exports.getPrList = exports.getRepoForceRebase = exports.initRepo = exports.getJsonFile = exports.getRawFile = exports.getRepos = exports.initPlatform = void 0;
const tslib_1 = require("tslib");
const url_1 = tslib_1.__importDefault(require("url"));
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const json5_1 = tslib_1.__importDefault(require("json5"));
const constants_1 = require("../../../constants");
const error_messages_1 = require("../../../constants/error-messages");
const logger_1 = require("../../../logger");
const types_1 = require("../../../types");
const git = tslib_1.__importStar(require("../../../util/git"));
const hostRules = tslib_1.__importStar(require("../../../util/host-rules"));
const bitbucket_1 = require("../../../util/http/bitbucket");
const regex_1 = require("../../../util/regex");
const sanitize_1 = require("../../../util/sanitize");
const pr_body_1 = require("../utils/pr-body");
const read_only_issue_body_1 = require("../utils/read-only-issue-body");
const comments = tslib_1.__importStar(require("./comments"));
const utils = tslib_1.__importStar(require("./utils"));
const utils_1 = require("./utils");
const bitbucketHttp = new bitbucket_1.BitbucketHttp();
const BITBUCKET_PROD_ENDPOINT = 'https://api.bitbucket.org/';
let config = {};
const defaults = { endpoint: BITBUCKET_PROD_ENDPOINT };
const pathSeparator = '/';
let renovateUserUuid = null;
async function initPlatform({ endpoint, username, password, }) {
    if (!(username && password)) {
        throw new Error('Init: You must configure a Bitbucket username and password');
    }
    if (endpoint && endpoint !== BITBUCKET_PROD_ENDPOINT) {
        logger_1.logger.warn(`Init: Bitbucket Cloud endpoint should generally be ${BITBUCKET_PROD_ENDPOINT} but is being configured to a different value. Did you mean to use Bitbucket Server?`);
        defaults.endpoint = endpoint;
    }
    (0, bitbucket_1.setBaseUrl)(defaults.endpoint);
    renovateUserUuid = null;
    try {
        const { uuid } = (await bitbucketHttp.getJson('/2.0/user', {
            username,
            password,
            useCache: false,
        })).body;
        renovateUserUuid = uuid;
    }
    catch (err) {
        if (err.statusCode === 403 &&
            err.body?.error?.detail?.required?.includes('account')) {
            logger_1.logger.warn(`Bitbucket: missing 'account' scope for password`);
        }
        else {
            logger_1.logger.debug({ err }, 'Unknown error fetching Bitbucket user identity');
        }
    }
    // TODO: Add a connection check that endpoint/username/password combination are valid (#9594)
    const platformConfig = {
        endpoint: endpoint || BITBUCKET_PROD_ENDPOINT,
    };
    return Promise.resolve(platformConfig);
}
exports.initPlatform = initPlatform;
// Get all repositories that the user has access to
async function getRepos() {
    logger_1.logger.debug('Autodiscovering Bitbucket Cloud repositories');
    try {
        const repos = await utils.accumulateValues(`/2.0/repositories/?role=contributor`);
        return repos.map((repo) => repo.full_name);
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.error({ err }, `bitbucket getRepos error`);
        throw err;
    }
}
exports.getRepos = getRepos;
async function getRawFile(fileName, repoName, branchOrTag) {
    // See: https://developer.atlassian.com/bitbucket/api/2/reference/resource/repositories/%7Bworkspace%7D/%7Brepo_slug%7D/src/%7Bcommit%7D/%7Bpath%7D
    const repo = repoName ?? config.repository;
    const path = fileName;
    let finalBranchOrTag = branchOrTag;
    if (branchOrTag?.includes(pathSeparator)) {
        // Branch name contans slash, so we have to replace branch name with SHA1 of the head commit; otherwise the API will not work.
        finalBranchOrTag = await getBranchCommit(branchOrTag);
    }
    const url = `/2.0/repositories/${repo}/src/` +
        (finalBranchOrTag || `HEAD`) +
        `/${path}`;
    const res = await bitbucketHttp.get(url);
    return res.body;
}
exports.getRawFile = getRawFile;
async function getJsonFile(fileName, repoName, branchOrTag) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const raw = (await getRawFile(fileName, repoName, branchOrTag));
    return json5_1.default.parse(raw);
}
exports.getJsonFile = getJsonFile;
// Initialize bitbucket by getting base branch and SHA
async function initRepo({ repository, cloneSubmodules, ignorePrAuthor, }) {
    logger_1.logger.debug(`initRepo("${repository}")`);
    const opts = hostRules.find({
        hostType: constants_1.PlatformId.Bitbucket,
        url: defaults.endpoint,
    });
    config = {
        repository,
        username: opts.username,
        ignorePrAuthor,
    };
    let info;
    try {
        info = utils.repoInfoTransformer((await bitbucketHttp.getJson(`/2.0/repositories/${repository}`)).body);
        config.defaultBranch = info.mainbranch;
        config = {
            ...config,
            owner: info.owner,
            mergeMethod: info.mergeMethod,
            has_issues: info.has_issues,
        };
        logger_1.logger.debug(`${repository} owner = ${config.owner}`);
    }
    catch (err) /* istanbul ignore next */ {
        if (err.statusCode === 404) {
            throw new Error(error_messages_1.REPOSITORY_NOT_FOUND);
        }
        logger_1.logger.debug({ err }, 'Unknown Bitbucket initRepo error');
        throw err;
    }
    const { hostname } = url_1.default.parse(defaults.endpoint);
    // Converts API hostnames to their respective HTTP git hosts:
    // `api.bitbucket.org`  to `bitbucket.org`
    // `api-staging.<host>` to `staging.<host>`
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const hostnameWithoutApiPrefix = (0, regex_1.regEx)(/api[.|-](.+)/).exec(hostname)?.[1];
    const url = git.getUrl({
        protocol: 'https',
        auth: `${opts.username}:${opts.password}`,
        hostname: hostnameWithoutApiPrefix,
        repository,
    });
    await git.initRepo({
        ...config,
        url,
        cloneSubmodules,
    });
    const repoConfig = {
        defaultBranch: info.mainbranch,
        isFork: info.isFork,
    };
    return repoConfig;
}
exports.initRepo = initRepo;
// Returns true if repository has rule enforcing PRs are up-to-date with base branch before merging
function getRepoForceRebase() {
    // BB doesn't have an option to flag staled branches
    return Promise.resolve(false);
}
exports.getRepoForceRebase = getRepoForceRebase;
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
async function getPrList() {
    logger_1.logger.debug('getPrList()');
    if (!config.prList) {
        logger_1.logger.debug('Retrieving PR list');
        let url = `/2.0/repositories/${config.repository}/pullrequests?`;
        url += utils.prStates.all.map((state) => 'state=' + state).join('&');
        if (renovateUserUuid && !config.ignorePrAuthor) {
            url += `&q=author.uuid="${renovateUserUuid}"`;
        }
        const prs = await utils.accumulateValues(url, undefined, undefined, 50);
        config.prList = prs.map(utils.prInfo);
        logger_1.logger.debug({ length: config.prList.length }, 'Retrieved Pull Requests');
    }
    return config.prList;
}
exports.getPrList = getPrList;
async function findPr({ branchName, prTitle, state = types_1.PrState.All, }) {
    logger_1.logger.debug(`findPr(${branchName}, ${prTitle}, ${state})`);
    const prList = await getPrList();
    const pr = prList.find((p) => p.sourceBranch === branchName &&
        (!prTitle || p.title === prTitle) &&
        matchesState(p.state, state));
    if (pr) {
        logger_1.logger.debug(`Found PR #${pr.number}`);
    }
    return pr ?? null;
}
exports.findPr = findPr;
// Gets details for a PR
async function getPr(prNo) {
    const pr = (await bitbucketHttp.getJson(`/2.0/repositories/${config.repository}/pullrequests/${prNo}`)).body;
    // istanbul ignore if
    if (!pr) {
        return null;
    }
    const res = {
        displayNumber: `Pull Request #${pr.id}`,
        ...utils.prInfo(pr),
    };
    res.hasReviewers = is_1.default.nonEmptyArray(pr.reviewers);
    return res;
}
exports.getPr = getPr;
const escapeHash = (input) => input ? input.replace((0, regex_1.regEx)(/#/g), '%23') : input;
// Return the commit SHA for a branch
async function getBranchCommit(branchName) {
    try {
        const branch = (await bitbucketHttp.getJson(`/2.0/repositories/${config.repository}/refs/branches/${escapeHash(branchName)}`)).body;
        return branch.target.hash;
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.debug({ err }, `getBranchCommit('${branchName}') failed'`);
        return undefined;
    }
}
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
async function getStatus(branchName, useCache = true) {
    const sha = await getBranchCommit(branchName);
    return utils.accumulateValues(`/2.0/repositories/${config.repository}/commit/${sha}/statuses`, 'get', { useCache });
}
// Returns the combined status for a branch.
async function getBranchStatus(branchName) {
    logger_1.logger.debug(`getBranchStatus(${branchName})`);
    const statuses = await getStatus(branchName);
    logger_1.logger.debug({ branch: branchName, statuses }, 'branch status check result');
    if (!statuses.length) {
        logger_1.logger.debug('empty branch status check result = returning "pending"');
        return types_1.BranchStatus.yellow;
    }
    const noOfFailures = statuses.filter((status) => status.state === 'FAILED' || status.state === 'STOPPED').length;
    if (noOfFailures) {
        return types_1.BranchStatus.red;
    }
    const noOfPending = statuses.filter((status) => status.state === 'INPROGRESS').length;
    if (noOfPending) {
        return types_1.BranchStatus.yellow;
    }
    return types_1.BranchStatus.green;
}
exports.getBranchStatus = getBranchStatus;
const bbToRenovateStatusMapping = {
    SUCCESSFUL: types_1.BranchStatus.green,
    INPROGRESS: types_1.BranchStatus.yellow,
    FAILED: types_1.BranchStatus.red,
};
async function getBranchStatusCheck(branchName, context) {
    const statuses = await getStatus(branchName);
    const bbState = statuses.find((status) => status.key === context)?.state;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    return bbToRenovateStatusMapping[bbState] || null;
}
exports.getBranchStatusCheck = getBranchStatusCheck;
async function setBranchStatus({ branchName, context, description, state, url: targetUrl, }) {
    const sha = await getBranchCommit(branchName);
    // TargetUrl can not be empty so default to bitbucket
    const url = targetUrl || /* istanbul ignore next */ 'https://bitbucket.org';
    const body = {
        name: context,
        state: utils.buildStates[state],
        key: context,
        description,
        url,
    };
    await bitbucketHttp.postJson(`/2.0/repositories/${config.repository}/commit/${sha}/statuses/build`, { body });
    // update status cache
    await getStatus(branchName, false);
}
exports.setBranchStatus = setBranchStatus;
async function findOpenIssues(title) {
    try {
        const filter = encodeURIComponent([
            `title=${JSON.stringify(title)}`,
            '(state = "new" OR state = "open")',
            `reporter.username="${config.username}"`,
        ].join(' AND '));
        return ((await bitbucketHttp.getJson(`/2.0/repositories/${config.repository}/issues?q=${filter}`)).body.values || /* istanbul ignore next */ []);
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.warn({ err }, 'Error finding issues');
        return [];
    }
}
async function findIssue(title) {
    logger_1.logger.debug(`findIssue(${title})`);
    /* istanbul ignore if */
    if (!config.has_issues) {
        logger_1.logger.debug('Issues are disabled - cannot findIssue');
        return null;
    }
    const issues = await findOpenIssues(title);
    if (!issues.length) {
        return null;
    }
    const [issue] = issues;
    return {
        number: issue.id,
        body: issue.content?.raw,
    };
}
exports.findIssue = findIssue;
async function closeIssue(issueNumber) {
    await bitbucketHttp.putJson(`/2.0/repositories/${config.repository}/issues/${issueNumber}`, {
        body: { state: 'closed' },
    });
}
function massageMarkdown(input) {
    // Remove any HTML we use
    return (0, pr_body_1.smartTruncate)(input, 50000)
        .replace('you tick the rebase/retry checkbox', 'rename PR to start with "rebase!"')
        .replace((0, regex_1.regEx)(/<\/?summary>/g), '**')
        .replace((0, regex_1.regEx)(/<\/?details>/g), '')
        .replace((0, regex_1.regEx)(`\n---\n\n.*?<!-- rebase-check -->.*?\n`), '')
        .replace((0, regex_1.regEx)(/\]\(\.\.\/pull\//g), '](../../pull-requests/');
}
exports.massageMarkdown = massageMarkdown;
async function ensureIssue({ title, reuseTitle, body, }) {
    logger_1.logger.debug(`ensureIssue()`);
    const description = massageMarkdown((0, sanitize_1.sanitize)(body));
    /* istanbul ignore if */
    if (!config.has_issues) {
        logger_1.logger.warn('Issues are disabled - cannot ensureIssue');
        logger_1.logger.debug({ title }, 'Failed to ensure Issue');
        return null;
    }
    try {
        let issues = await findOpenIssues(title);
        if (!issues.length && reuseTitle) {
            issues = await findOpenIssues(reuseTitle);
        }
        if (issues.length) {
            // Close any duplicates
            for (const issue of issues.slice(1)) {
                await closeIssue(issue.id);
            }
            const [issue] = issues;
            if (issue.title !== title ||
                String(issue.content?.raw).trim() !== description.trim()) {
                logger_1.logger.debug('Issue updated');
                await bitbucketHttp.putJson(`/2.0/repositories/${config.repository}/issues/${issue.id}`, {
                    body: {
                        content: {
                            raw: (0, read_only_issue_body_1.readOnlyIssueBody)(description),
                            markup: 'markdown',
                        },
                    },
                });
                return 'updated';
            }
        }
        else {
            logger_1.logger.info('Issue created');
            await bitbucketHttp.postJson(`/2.0/repositories/${config.repository}/issues`, {
                body: {
                    title,
                    content: {
                        raw: (0, read_only_issue_body_1.readOnlyIssueBody)(description),
                        markup: 'markdown',
                    },
                },
            });
            return 'created';
        }
    }
    catch (err) /* istanbul ignore next */ {
        if (err.message.startsWith('Repository has no issue tracker.')) {
            logger_1.logger.debug(`Issues are disabled, so could not create issue: ${title}`);
        }
        else {
            logger_1.logger.warn({ err }, 'Could not ensure issue');
        }
    }
    return null;
}
exports.ensureIssue = ensureIssue;
/* istanbul ignore next */
async function getIssueList() {
    logger_1.logger.debug(`getIssueList()`);
    if (!config.has_issues) {
        logger_1.logger.debug('Issues are disabled - cannot getIssueList');
        return [];
    }
    try {
        const filter = encodeURIComponent([
            '(state = "new" OR state = "open")',
            `reporter.username="${config.username}"`,
        ].join(' AND '));
        return ((await bitbucketHttp.getJson(`/2.0/repositories/${config.repository}/issues?q=${filter}`)).body.values || []);
    }
    catch (err) {
        logger_1.logger.warn({ err }, 'Error finding issues');
        return [];
    }
}
exports.getIssueList = getIssueList;
async function ensureIssueClosing(title) {
    /* istanbul ignore if */
    if (!config.has_issues) {
        logger_1.logger.debug('Issues are disabled - cannot ensureIssueClosing');
        return;
    }
    const issues = await findOpenIssues(title);
    for (const issue of issues) {
        await closeIssue(issue.id);
    }
}
exports.ensureIssueClosing = ensureIssueClosing;
function addAssignees(_prNr, _assignees) {
    // Bitbucket supports "participants" and "reviewers" so does not seem to have the concept of "assignee"
    logger_1.logger.warn('Cannot add assignees');
    return Promise.resolve();
}
exports.addAssignees = addAssignees;
async function addReviewers(prId, reviewers) {
    logger_1.logger.debug(`Adding reviewers '${reviewers.join(', ')}' to #${prId}`);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const { title } = (await getPr(prId));
    const body = {
        title,
        reviewers: reviewers.map((username) => ({ username })),
    };
    await bitbucketHttp.putJson(`/2.0/repositories/${config.repository}/pullrequests/${prId}`, {
        body,
    });
}
exports.addReviewers = addReviewers;
/* istanbul ignore next */
function deleteLabel() {
    throw new Error('deleteLabel not implemented');
}
exports.deleteLabel = deleteLabel;
function ensureComment({ number, topic, content, }) {
    // https://developer.atlassian.com/bitbucket/api/2/reference/search?q=pullrequest+comment
    return comments.ensureComment({
        config,
        number,
        topic,
        content: (0, sanitize_1.sanitize)(content),
    });
}
exports.ensureComment = ensureComment;
function ensureCommentRemoval(deleteConfig) {
    return comments.ensureCommentRemoval(config, deleteConfig);
}
exports.ensureCommentRemoval = ensureCommentRemoval;
async function sanitizeReviewers(reviewers, err) {
    if (err.statusCode === 400 && err.body?.error?.fields?.reviewers) {
        const sanitizedReviewers = [];
        for (const msg of err.body.error.fields.reviewers) {
            // Bitbucket returns a 400 if any of the PR reviewer accounts are now inactive (ie: disabled/suspended)
            if (msg === 'Malformed reviewers list') {
                logger_1.logger.debug({ err }, 'PR contains inactive reviewer accounts. Will try setting only active reviewers');
                // Validate that each previous PR reviewer account is still active
                for (const reviewer of reviewers) {
                    const reviewerUser = (await bitbucketHttp.getJson(`/2.0/users/${reviewer.uuid}`)).body;
                    if (reviewerUser.account_status === 'active') {
                        sanitizedReviewers.push(reviewer);
                    }
                }
                // Bitbucket returns a 400 if any of the PR reviewer accounts are no longer members of this workspace
            }
            else if (msg.endsWith('is not a member of this workspace and cannot be added to this pull request')) {
                logger_1.logger.debug({ err }, 'PR contains reviewer accounts which are no longer member of this workspace. Will try setting only member reviewers');
                const workspace = config.repository.split('/')[0];
                // Validate that each previous PR reviewer account is still a member of this workspace
                for (const reviewer of reviewers) {
                    try {
                        await bitbucketHttp.get(`/2.0/workspaces/${workspace}/members/${reviewer.uuid}`);
                        sanitizedReviewers.push(reviewer);
                    }
                    catch (err) {
                        // HTTP 404: User cannot be found, or the user is not a member of this workspace.
                        if (err.response?.statusCode !== 404) {
                            throw err;
                        }
                    }
                }
            }
            else {
                return undefined;
            }
        }
        return sanitizedReviewers;
    }
    return undefined;
}
// Creates PR and returns PR number
async function createPr({ sourceBranch, targetBranch, prTitle: title, prBody: description, platformOptions, }) {
    // labels is not supported in Bitbucket: https://bitbucket.org/site/master/issues/11976/ability-to-add-labels-to-pull-requests-bb
    const base = targetBranch;
    logger_1.logger.debug({ repository: config.repository, title, base }, 'Creating PR');
    let reviewers = [];
    if (platformOptions?.bbUseDefaultReviewers) {
        const reviewersResponse = (await bitbucketHttp.getJson(`/2.0/repositories/${config.repository}/default-reviewers`)).body;
        reviewers = reviewersResponse.values.map((reviewer) => ({
            uuid: reviewer.uuid,
        }));
    }
    const body = {
        title,
        description: (0, sanitize_1.sanitize)(description),
        source: {
            branch: {
                name: sourceBranch,
            },
        },
        destination: {
            branch: {
                name: base,
            },
        },
        close_source_branch: true,
        reviewers,
    };
    try {
        const prRes = (await bitbucketHttp.postJson(`/2.0/repositories/${config.repository}/pullrequests`, {
            body,
        })).body;
        const pr = utils.prInfo(prRes);
        // istanbul ignore if
        if (config.prList) {
            config.prList.push(pr);
        }
        return pr;
    }
    catch (err) /* istanbul ignore next */ {
        // Try sanitizing reviewers
        const sanitizedReviewers = await sanitizeReviewers(reviewers, err);
        if (sanitizedReviewers === undefined) {
            logger_1.logger.warn({ err }, 'Error creating pull request');
            throw err;
        }
        else {
            const prRes = (await bitbucketHttp.postJson(`/2.0/repositories/${config.repository}/pullrequests`, {
                body: {
                    ...body,
                    reviewers: sanitizedReviewers,
                },
            })).body;
            const pr = utils.prInfo(prRes);
            // istanbul ignore if
            if (config.prList) {
                config.prList.push(pr);
            }
            return pr;
        }
    }
}
exports.createPr = createPr;
async function updatePr({ number: prNo, prTitle: title, prBody: description, state, }) {
    logger_1.logger.debug(`updatePr(${prNo}, ${title}, body)`);
    // Updating a PR in Bitbucket will clear the reviewers if reviewers is not present
    const pr = (await bitbucketHttp.getJson(`/2.0/repositories/${config.repository}/pullrequests/${prNo}`)).body;
    try {
        await bitbucketHttp.putJson(`/2.0/repositories/${config.repository}/pullrequests/${prNo}`, {
            body: {
                title,
                description: (0, sanitize_1.sanitize)(description),
                reviewers: pr.reviewers,
            },
        });
    }
    catch (err) {
        // Try sanitizing reviewers
        const sanitizedReviewers = await sanitizeReviewers(pr.reviewers, err);
        if (sanitizedReviewers === undefined) {
            throw err;
        }
        else {
            await bitbucketHttp.putJson(`/2.0/repositories/${config.repository}/pullrequests/${prNo}`, {
                body: {
                    title,
                    description: (0, sanitize_1.sanitize)(description),
                    reviewers: sanitizedReviewers,
                },
            });
        }
    }
    if (state === types_1.PrState.Closed && pr) {
        await bitbucketHttp.postJson(`/2.0/repositories/${config.repository}/pullrequests/${prNo}/decline`);
    }
}
exports.updatePr = updatePr;
async function mergePr({ branchName, id: prNo, strategy: mergeStrategy, }) {
    logger_1.logger.debug(`mergePr(${prNo}, ${branchName}, ${mergeStrategy})`);
    // Bitbucket Cloud does not support a rebase-alike; https://jira.atlassian.com/browse/BCLOUD-16610
    if (mergeStrategy === 'rebase') {
        logger_1.logger.warn('Bitbucket Cloud does not support a "rebase" strategy.');
        return false;
    }
    try {
        await bitbucketHttp.postJson(`/2.0/repositories/${config.repository}/pullrequests/${prNo}/merge`, {
            body: (0, utils_1.mergeBodyTransformer)(mergeStrategy),
        });
        logger_1.logger.debug('Automerging succeeded');
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.debug({ err }, `PR merge error`);
        logger_1.logger.info({ pr: prNo }, 'PR automerge failed');
        return false;
    }
    return true;
}
exports.mergePr = mergePr;
function getVulnerabilityAlerts() {
    return Promise.resolve([]);
}
exports.getVulnerabilityAlerts = getVulnerabilityAlerts;
//# sourceMappingURL=index.js.map