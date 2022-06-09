"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVulnerabilityAlerts = exports.deleteLabel = exports.addReviewers = exports.addAssignees = exports.getIssueList = exports.ensureIssueClosing = exports.ensureIssue = exports.findIssue = exports.massageMarkdown = exports.mergePr = exports.setBranchStatus = exports.ensureCommentRemoval = exports.ensureComment = exports.updatePr = exports.createPr = exports.getBranchStatus = exports.getBranchStatusCheck = exports.getBranchPr = exports.findPr = exports.getPr = exports.getPrList = exports.getRepoForceRebase = exports.initRepo = exports.getJsonFile = exports.getRawFile = exports.getRepos = exports.initPlatform = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const GitInterfaces_js_1 = require("azure-devops-node-api/interfaces/GitInterfaces.js");
const delay_1 = tslib_1.__importDefault(require("delay"));
const json5_1 = tslib_1.__importDefault(require("json5"));
const constants_1 = require("../../../constants");
const error_messages_1 = require("../../../constants/error-messages");
const logger_1 = require("../../../logger");
const types_1 = require("../../../types");
const git = tslib_1.__importStar(require("../../../util/git"));
const hostRules = tslib_1.__importStar(require("../../../util/host-rules"));
const regex_1 = require("../../../util/regex");
const sanitize_1 = require("../../../util/sanitize");
const streams_1 = require("../../../util/streams");
const url_1 = require("../../../util/url");
const pr_body_1 = require("../utils/pr-body");
const azureApi = tslib_1.__importStar(require("./azure-got-wrapper"));
const azureHelper = tslib_1.__importStar(require("./azure-helper"));
const types_2 = require("./types");
const util_1 = require("./util");
let config = {};
const defaults = {
    hostType: constants_1.PlatformId.Azure,
};
function initPlatform({ endpoint, token, username, password, }) {
    if (!endpoint) {
        throw new Error('Init: You must configure an Azure DevOps endpoint');
    }
    if (!token && !(username && password)) {
        throw new Error('Init: You must configure an Azure DevOps token, or a username and password');
    }
    // TODO: Add a connection check that endpoint/token combination are valid (#9593)
    const res = {
        endpoint: (0, url_1.ensureTrailingSlash)(endpoint),
    };
    defaults.endpoint = res.endpoint;
    azureApi.setEndpoint(res.endpoint);
    const platformConfig = {
        endpoint: defaults.endpoint,
    };
    return Promise.resolve(platformConfig);
}
exports.initPlatform = initPlatform;
async function getRepos() {
    logger_1.logger.debug('Autodiscovering Azure DevOps repositories');
    const azureApiGit = await azureApi.gitApi();
    const repos = await azureApiGit.getRepositories();
    return repos.map((repo) => `${repo.project?.name}/${repo.name}`);
}
exports.getRepos = getRepos;
async function getRawFile(fileName, repoName, branchOrTag) {
    const azureApiGit = await azureApi.gitApi();
    let repoId;
    if (repoName) {
        const repos = await azureApiGit.getRepositories();
        const repo = (0, util_1.getRepoByName)(repoName, repos);
        repoId = repo?.id;
    }
    else {
        repoId = config.repoId;
    }
    const versionDescriptor = {
        version: branchOrTag,
    };
    const buf = await azureApiGit.getItemContent(
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    repoId, fileName, undefined, undefined, undefined, undefined, undefined, undefined, branchOrTag ? versionDescriptor : undefined);
    const str = await (0, streams_1.streamToString)(buf);
    return str;
}
exports.getRawFile = getRawFile;
async function getJsonFile(fileName, repoName, branchOrTag) {
    const raw = await getRawFile(fileName, repoName, branchOrTag);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    return json5_1.default.parse(raw);
}
exports.getJsonFile = getJsonFile;
async function initRepo({ repository, cloneSubmodules, }) {
    logger_1.logger.debug(`initRepo("${repository}")`);
    config = { repository };
    const azureApiGit = await azureApi.gitApi();
    const repos = await azureApiGit.getRepositories();
    const repo = (0, util_1.getRepoByName)(repository, repos);
    if (!repo) {
        logger_1.logger.error({ repos, repo }, 'Could not find repo in repo list');
        throw new Error(error_messages_1.REPOSITORY_NOT_FOUND);
    }
    logger_1.logger.debug({ repositoryDetails: repo }, 'Repository details');
    if (repo.isDisabled) {
        logger_1.logger.debug('Repository is disabled- throwing error to abort renovation');
        throw new Error(error_messages_1.REPOSITORY_ARCHIVED);
    }
    // istanbul ignore if
    if (!repo.defaultBranch) {
        logger_1.logger.debug('Repo is empty');
        throw new Error(error_messages_1.REPOSITORY_EMPTY);
    }
    config.repoId = repo.id;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    config.project = repo.project.name;
    config.owner = '?owner?';
    logger_1.logger.debug(`${repository} owner = ${config.owner}`);
    const defaultBranch = repo.defaultBranch.replace('refs/heads/', '');
    config.defaultBranch = defaultBranch;
    logger_1.logger.debug(`${repository} default branch = ${defaultBranch}`);
    const names = (0, util_1.getProjectAndRepo)(repository);
    config.defaultMergeMethod = await azureHelper.getMergeMethod(
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    repo.id, names.project, null, defaultBranch);
    config.mergeMethods = {};
    config.repoForceRebase = false;
    const [projectName, repoName] = repository.split('/');
    const opts = hostRules.find({
        hostType: defaults.hostType,
        url: defaults.endpoint,
    });
    const manualUrl = defaults.endpoint +
        `${encodeURIComponent(projectName)}/_git/${encodeURIComponent(repoName)}`;
    const url = repo.remoteUrl || manualUrl;
    await git.initRepo({
        ...config,
        url,
        extraCloneOpts: (0, util_1.getStorageExtraCloneOpts)(opts),
        cloneSubmodules,
    });
    const repoConfig = {
        defaultBranch,
        isFork: false,
    };
    return repoConfig;
}
exports.initRepo = initRepo;
function getRepoForceRebase() {
    return Promise.resolve(config.repoForceRebase === true);
}
exports.getRepoForceRebase = getRepoForceRebase;
async function getPrList() {
    logger_1.logger.debug('getPrList()');
    if (!config.prList) {
        const azureApiGit = await azureApi.gitApi();
        let prs = [];
        let fetchedPrs;
        let skip = 0;
        do {
            fetchedPrs = await azureApiGit.getPullRequests(config.repoId, { status: 4 }, config.project, 0, skip, 100);
            prs = prs.concat(fetchedPrs);
            skip += 100;
        } while (fetchedPrs.length > 0);
        config.prList = prs.map(util_1.getRenovatePRFormat);
        logger_1.logger.debug({ length: config.prList.length }, 'Retrieved Pull Requests');
    }
    return config.prList;
}
exports.getPrList = getPrList;
async function getPr(pullRequestId) {
    logger_1.logger.debug(`getPr(${pullRequestId})`);
    if (!pullRequestId) {
        return null;
    }
    const azurePr = (await getPrList()).find((item) => item.number === pullRequestId);
    if (!azurePr) {
        return null;
    }
    const azureApiGit = await azureApi.gitApi();
    const labels = await azureApiGit.getPullRequestLabels(config.repoId, pullRequestId);
    azurePr.labels = labels
        .filter((label) => label.active)
        .map((label) => label.name)
        .filter(is_1.default.string);
    azurePr.hasReviewers = is_1.default.nonEmptyArray(azurePr.reviewers);
    return azurePr;
}
exports.getPr = getPr;
async function findPr({ branchName, prTitle, state = types_1.PrState.All, }) {
    let prsFiltered = [];
    try {
        const prs = await getPrList();
        prsFiltered = prs.filter((item) => item.sourceRefName === (0, util_1.getNewBranchName)(branchName));
        if (prTitle) {
            prsFiltered = prsFiltered.filter((item) => item.title === prTitle);
        }
        switch (state) {
            case types_1.PrState.All:
                // no more filter needed, we can go further...
                break;
            case types_1.PrState.NotOpen:
                prsFiltered = prsFiltered.filter((item) => item.state !== types_1.PrState.Open);
                break;
            default:
                prsFiltered = prsFiltered.filter((item) => item.state === state);
                break;
        }
    }
    catch (err) {
        logger_1.logger.error({ err }, 'findPr error');
    }
    if (prsFiltered.length === 0) {
        return null;
    }
    return prsFiltered[0];
}
exports.findPr = findPr;
async function getBranchPr(branchName) {
    logger_1.logger.debug(`getBranchPr(${branchName})`);
    const existingPr = await findPr({
        branchName,
        state: types_1.PrState.Open,
    });
    return existingPr ? getPr(existingPr.number) : null;
}
exports.getBranchPr = getBranchPr;
async function getStatusCheck(branchName) {
    const azureApiGit = await azureApi.gitApi();
    const branch = await azureApiGit.getBranch(config.repoId, 
    // TODO: fix undefined
    (0, util_1.getBranchNameWithoutRefsheadsPrefix)(branchName));
    // only grab the latest statuses, it will group any by context
    return azureApiGit.getStatuses(
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    branch.commit.commitId, config.repoId, undefined, undefined, undefined, true);
}
const azureToRenovateStatusMapping = {
    [GitInterfaces_js_1.GitStatusState.Succeeded]: types_1.BranchStatus.green,
    [GitInterfaces_js_1.GitStatusState.NotApplicable]: types_1.BranchStatus.green,
    [GitInterfaces_js_1.GitStatusState.NotSet]: types_1.BranchStatus.yellow,
    [GitInterfaces_js_1.GitStatusState.Pending]: types_1.BranchStatus.yellow,
    [GitInterfaces_js_1.GitStatusState.Error]: types_1.BranchStatus.red,
    [GitInterfaces_js_1.GitStatusState.Failed]: types_1.BranchStatus.red,
};
async function getBranchStatusCheck(branchName, context) {
    const res = await getStatusCheck(branchName);
    for (const check of res) {
        if ((0, util_1.getGitStatusContextCombinedName)(check.context) === context) {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            return azureToRenovateStatusMapping[check.state] ?? types_1.BranchStatus.yellow;
        }
    }
    return null;
}
exports.getBranchStatusCheck = getBranchStatusCheck;
async function getBranchStatus(branchName) {
    logger_1.logger.debug(`getBranchStatus(${branchName})`);
    const statuses = await getStatusCheck(branchName);
    logger_1.logger.debug({ branch: branchName, statuses }, 'branch status check result');
    if (!statuses.length) {
        logger_1.logger.debug('empty branch status check result = returning "pending"');
        return types_1.BranchStatus.yellow;
    }
    const noOfFailures = statuses.filter((status) => status.state === GitInterfaces_js_1.GitStatusState.Error ||
        status.state === GitInterfaces_js_1.GitStatusState.Failed).length;
    if (noOfFailures) {
        return types_1.BranchStatus.red;
    }
    const noOfPending = statuses.filter((status) => status.state === GitInterfaces_js_1.GitStatusState.NotSet ||
        status.state === GitInterfaces_js_1.GitStatusState.Pending).length;
    if (noOfPending) {
        return types_1.BranchStatus.yellow;
    }
    return types_1.BranchStatus.green;
}
exports.getBranchStatus = getBranchStatus;
async function createPr({ sourceBranch, targetBranch, prTitle: title, prBody: body, labels, draftPR = false, platformOptions, }) {
    const sourceRefName = (0, util_1.getNewBranchName)(sourceBranch);
    const targetRefName = (0, util_1.getNewBranchName)(targetBranch);
    const description = (0, util_1.max4000Chars)((0, sanitize_1.sanitize)(body));
    const azureApiGit = await azureApi.gitApi();
    const workItemRefs = [
        {
            id: platformOptions?.azureWorkItemId?.toString(),
        },
    ];
    let pr = await azureApiGit.createPullRequest({
        sourceRefName,
        targetRefName,
        title,
        description,
        workItemRefs,
        isDraft: draftPR,
    }, config.repoId);
    if (platformOptions?.usePlatformAutomerge) {
        pr = await azureApiGit.updatePullRequest({
            autoCompleteSetBy: {
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                id: pr.createdBy.id,
            },
            completionOptions: {
                mergeStrategy: config.defaultMergeMethod,
                deleteSourceBranch: true,
                mergeCommitMessage: title,
            },
        }, config.repoId, 
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        pr.pullRequestId);
    }
    if (platformOptions?.azureAutoApprove) {
        await azureApiGit.createPullRequestReviewer({
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            reviewerUrl: pr.createdBy.url,
            vote: types_2.AzurePrVote.Approved,
            isFlagged: false,
            isRequired: false,
        }, config.repoId, 
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        pr.pullRequestId, 
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        pr.createdBy.id);
    }
    await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    labels.map((label) => azureApiGit.createPullRequestLabel({
        name: label,
    }, config.repoId, 
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    pr.pullRequestId)));
    return (0, util_1.getRenovatePRFormat)(pr);
}
exports.createPr = createPr;
async function updatePr({ number: prNo, prTitle: title, prBody: body, state, }) {
    logger_1.logger.debug(`updatePr(${prNo}, ${title}, body)`);
    const azureApiGit = await azureApi.gitApi();
    const objToUpdate = {
        title,
    };
    if (body) {
        objToUpdate.description = (0, util_1.max4000Chars)((0, sanitize_1.sanitize)(body));
    }
    if (state === types_1.PrState.Open) {
        await azureApiGit.updatePullRequest({ status: GitInterfaces_js_1.PullRequestStatus.Active }, config.repoId, prNo);
    }
    else if (state === types_1.PrState.Closed) {
        objToUpdate.status = GitInterfaces_js_1.PullRequestStatus.Abandoned;
    }
    await azureApiGit.updatePullRequest(objToUpdate, config.repoId, prNo);
}
exports.updatePr = updatePr;
async function ensureComment({ number, topic, content, }) {
    logger_1.logger.debug(`ensureComment(${number}, ${topic}, content)`);
    const header = topic ? `### ${topic}\n\n` : '';
    const body = `${header}${(0, sanitize_1.sanitize)(content)}`;
    const azureApiGit = await azureApi.gitApi();
    const threads = await azureApiGit.getThreads(config.repoId, number);
    let threadIdFound;
    let commentIdFound;
    let commentNeedsUpdating = false;
    threads.forEach((thread) => {
        const firstCommentContent = thread.comments?.[0].content;
        if ((topic && firstCommentContent?.startsWith(header)) ||
            (!topic && firstCommentContent === body)) {
            threadIdFound = thread.id;
            commentIdFound = thread.comments?.[0].id;
            commentNeedsUpdating = firstCommentContent !== body;
        }
    });
    if (!threadIdFound) {
        await azureApiGit.createThread({
            comments: [{ content: body, commentType: 1, parentCommentId: 0 }],
            status: 1,
        }, config.repoId, number);
        logger_1.logger.info({ repository: config.repository, issueNo: number, topic }, 'Comment added');
    }
    else if (commentNeedsUpdating) {
        await azureApiGit.updateComment({
            content: body,
        }, config.repoId, number, threadIdFound, 
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        commentIdFound);
        logger_1.logger.debug({ repository: config.repository, issueNo: number, topic }, 'Comment updated');
    }
    else {
        logger_1.logger.debug({ repository: config.repository, issueNo: number, topic }, 'Comment is already update-to-date');
    }
    return true;
}
exports.ensureComment = ensureComment;
async function ensureCommentRemoval(removeConfig) {
    const { number: issueNo } = removeConfig;
    const key = removeConfig.type === 'by-topic'
        ? removeConfig.topic
        : removeConfig.content;
    logger_1.logger.debug(`Ensuring comment "${key}" in #${issueNo} is removed`);
    const azureApiGit = await azureApi.gitApi();
    const threads = await azureApiGit.getThreads(config.repoId, issueNo);
    let threadIdFound = null;
    if (removeConfig.type === 'by-topic') {
        const thread = threads.find((thread) => !!thread.comments?.[0].content?.startsWith(`### ${removeConfig.topic}\n\n`));
        threadIdFound = thread?.id;
    }
    else {
        const thread = threads.find((thread) => thread.comments?.[0].content?.trim() === removeConfig.content);
        threadIdFound = thread?.id;
    }
    if (threadIdFound) {
        await azureApiGit.updateThread({
            status: 4, // close
        }, config.repoId, issueNo, threadIdFound);
    }
}
exports.ensureCommentRemoval = ensureCommentRemoval;
const renovateToAzureStatusMapping = {
    [types_1.BranchStatus.green]: [GitInterfaces_js_1.GitStatusState.Succeeded],
    [types_1.BranchStatus.green]: GitInterfaces_js_1.GitStatusState.Succeeded,
    [types_1.BranchStatus.yellow]: GitInterfaces_js_1.GitStatusState.Pending,
    [types_1.BranchStatus.red]: GitInterfaces_js_1.GitStatusState.Failed,
};
async function setBranchStatus({ branchName, context, description, state, url: targetUrl, }) {
    logger_1.logger.debug(`setBranchStatus(${branchName}, ${context}, ${description}, ${state}, ${targetUrl})`);
    const azureApiGit = await azureApi.gitApi();
    const branch = await azureApiGit.getBranch(config.repoId, (0, util_1.getBranchNameWithoutRefsheadsPrefix)(branchName));
    const statusToCreate = {
        description,
        context: (0, util_1.getGitStatusContextFromCombinedName)(context),
        state: renovateToAzureStatusMapping[state],
        targetUrl,
    };
    await azureApiGit.createCommitStatus(statusToCreate, 
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    branch.commit.commitId, config.repoId);
    logger_1.logger.trace(`Created commit status of ${state} on branch ${branchName}`);
}
exports.setBranchStatus = setBranchStatus;
async function mergePr({ branchName, id: pullRequestId, }) {
    logger_1.logger.debug(`mergePr(${pullRequestId}, ${branchName})`);
    const azureApiGit = await azureApi.gitApi();
    let pr = await azureApiGit.getPullRequestById(pullRequestId, config.project);
    const mergeMethod = 
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    config.mergeMethods[pr.targetRefName] ??
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        (config.mergeMethods[pr.targetRefName] = await azureHelper.getMergeMethod(config.repoId, config.project, pr.targetRefName, config.defaultBranch));
    const objToUpdate = {
        status: GitInterfaces_js_1.PullRequestStatus.Completed,
        lastMergeSourceCommit: pr.lastMergeSourceCommit,
        completionOptions: {
            mergeStrategy: mergeMethod,
            deleteSourceBranch: true,
            mergeCommitMessage: pr.title,
        },
    };
    logger_1.logger.trace(`Updating PR ${pullRequestId} to status ${GitInterfaces_js_1.PullRequestStatus.Completed} (${GitInterfaces_js_1.PullRequestStatus[GitInterfaces_js_1.PullRequestStatus.Completed]}) with lastMergeSourceCommit ${pr.lastMergeSourceCommit?.commitId} using mergeStrategy ${mergeMethod} (${GitInterfaces_js_1.GitPullRequestMergeStrategy[mergeMethod]})`);
    try {
        const response = await azureApiGit.updatePullRequest(objToUpdate, config.repoId, pullRequestId);
        let retries = 0;
        let isClosed = response.status === GitInterfaces_js_1.PullRequestStatus.Completed;
        while (!isClosed && retries < 5) {
            retries += 1;
            const sleepMs = retries * 1000;
            logger_1.logger.trace({ pullRequestId, status: pr.status, retries }, `Updated PR to closed status but change has not taken effect yet. Retrying...`);
            await (0, delay_1.default)(sleepMs);
            pr = await azureApiGit.getPullRequestById(pullRequestId, config.project);
            isClosed = pr.status === GitInterfaces_js_1.PullRequestStatus.Completed;
        }
        if (!isClosed) {
            logger_1.logger.warn({ pullRequestId, status: pr.status }, `Expected PR to have status ${GitInterfaces_js_1.PullRequestStatus[GitInterfaces_js_1.PullRequestStatus.Completed]
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            }, however it is ${GitInterfaces_js_1.PullRequestStatus[pr.status]}.`);
        }
        return true;
    }
    catch (err) {
        logger_1.logger.debug({ err }, 'Failed to set the PR as completed.');
        return false;
    }
}
exports.mergePr = mergePr;
function massageMarkdown(input) {
    // Remove any HTML we use
    return (0, pr_body_1.smartTruncate)(input, 4000)
        .replace('you tick the rebase/retry checkbox', 'rename PR to start with "rebase!"')
        .replace((0, regex_1.regEx)(`\n---\n\n.*?<!-- rebase-check -->.*?\n`), '');
}
exports.massageMarkdown = massageMarkdown;
/* istanbul ignore next */
function findIssue() {
    logger_1.logger.warn(`findIssue() is not implemented`);
    return Promise.resolve(null);
}
exports.findIssue = findIssue;
/* istanbul ignore next */
function ensureIssue() {
    logger_1.logger.warn(`ensureIssue() is not implemented`);
    return Promise.resolve(null);
}
exports.ensureIssue = ensureIssue;
/* istanbul ignore next */
function ensureIssueClosing() {
    return Promise.resolve();
}
exports.ensureIssueClosing = ensureIssueClosing;
/* istanbul ignore next */
function getIssueList() {
    logger_1.logger.debug(`getIssueList()`);
    // TODO: Needs implementation (#9592)
    return Promise.resolve([]);
}
exports.getIssueList = getIssueList;
async function getUserIds(users) {
    const azureApiGit = await azureApi.gitApi();
    const azureApiCore = await azureApi.coreApi();
    const repos = await azureApiGit.getRepositories();
    const repo = repos.filter((c) => c.id === config.repoId)[0];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const teams = await azureApiCore.getTeams(repo.project.id);
    const members = await Promise.all(teams.map(async (t) => await azureApiCore.getTeamMembersWithExtendedProperties(
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    repo.project.id, 
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    t.id)));
    const ids = [];
    members.forEach((listMembers) => {
        listMembers.forEach((m) => {
            users.forEach((r) => {
                if (r.toLowerCase() === m.identity?.displayName?.toLowerCase() ||
                    r.toLowerCase() === m.identity?.uniqueName?.toLowerCase()) {
                    if (ids.filter((c) => c.id === m.identity?.id).length === 0) {
                        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                        ids.push({ id: m.identity.id, name: r });
                    }
                }
            });
        });
    });
    teams.forEach((t) => {
        users.forEach((r) => {
            if (r.toLowerCase() === t.name?.toLowerCase()) {
                if (ids.filter((c) => c.id === t.id).length === 0) {
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                    ids.push({ id: t.id, name: r });
                }
            }
        });
    });
    return ids;
}
/**
 *
 * @param {number} issueNo
 * @param {string[]} assignees
 */
async function addAssignees(issueNo, assignees) {
    logger_1.logger.trace(`addAssignees(${issueNo}, [${assignees.join(', ')}])`);
    const ids = await getUserIds(assignees);
    await ensureComment({
        number: issueNo,
        topic: 'Add Assignees',
        content: ids.map((a) => `@<${a.id}>`).join(', '),
    });
}
exports.addAssignees = addAssignees;
/**
 *
 * @param {number} prNo
 * @param {string[]} reviewers
 */
async function addReviewers(prNo, reviewers) {
    logger_1.logger.trace(`addReviewers(${prNo}, [${reviewers.join(', ')}])`);
    const azureApiGit = await azureApi.gitApi();
    const ids = await getUserIds(reviewers);
    await Promise.all(ids.map(async (obj) => {
        await azureApiGit.createPullRequestReviewer({}, config.repoId, prNo, obj.id);
        logger_1.logger.debug(`Reviewer added: ${obj.name}`);
    }));
}
exports.addReviewers = addReviewers;
async function deleteLabel(prNumber, label) {
    logger_1.logger.debug(`Deleting label ${label} from #${prNumber}`);
    const azureApiGit = await azureApi.gitApi();
    await azureApiGit.deletePullRequestLabels(config.repoId, prNumber, label);
}
exports.deleteLabel = deleteLabel;
function getVulnerabilityAlerts() {
    return Promise.resolve([]);
}
exports.getVulnerabilityAlerts = getVulnerabilityAlerts;
//# sourceMappingURL=index.js.map