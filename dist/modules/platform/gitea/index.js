"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePr = exports.setBranchStatus = exports.mergePr = exports.initRepo = exports.initPlatform = exports.getVulnerabilityAlerts = exports.getRepos = exports.getRepoForceRebase = exports.getPrList = exports.massageMarkdown = exports.getPr = exports.getIssueList = exports.getJsonFile = exports.getRawFile = exports.getIssue = exports.getBranchStatusCheck = exports.getBranchStatus = exports.getBranchPr = exports.findPr = exports.findIssue = exports.ensureIssueClosing = exports.ensureIssue = exports.ensureCommentRemoval = exports.ensureComment = exports.deleteLabel = exports.createPr = exports.addReviewers = exports.addAssignees = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const json5_1 = tslib_1.__importDefault(require("json5"));
const semver_1 = tslib_1.__importDefault(require("semver"));
const constants_1 = require("../../../constants");
const error_messages_1 = require("../../../constants/error-messages");
const logger_1 = require("../../../logger");
const types_1 = require("../../../types");
const git = tslib_1.__importStar(require("../../../util/git"));
const gitea_1 = require("../../../util/http/gitea");
const sanitize_1 = require("../../../util/sanitize");
const url_1 = require("../../../util/url");
const pr_body_1 = require("../pr-body");
const pr_body_2 = require("../utils/pr-body");
const helper = tslib_1.__importStar(require("./gitea-helper"));
const utils_1 = require("./utils");
const defaults = {
    hostType: constants_1.PlatformId.Gitea,
    endpoint: 'https://gitea.com/',
    version: '0.0.0',
};
let config = {};
let botUserID;
let botUserName;
function toRenovateIssue(data) {
    return {
        number: data.number,
        state: data.state,
        title: data.title,
        body: data.body,
    };
}
function toRenovatePR(data) {
    if (!data) {
        return null;
    }
    if (!data.base?.ref ||
        !data.head?.label ||
        !data.head?.sha ||
        !data.head?.repo?.full_name) {
        logger_1.logger.trace(`Skipping Pull Request #${data.number} due to missing base and/or head branch`);
        return null;
    }
    const createdBy = data.user?.username;
    if (createdBy && botUserName && createdBy !== botUserName) {
        return null;
    }
    return {
        number: data.number,
        displayNumber: `Pull Request #${data.number}`,
        state: data.state,
        title: data.title,
        bodyStruct: (0, pr_body_1.getPrBodyStruct)(data.body),
        sha: data.head.sha,
        sourceBranch: data.head.label,
        targetBranch: data.base.ref,
        sourceRepo: data.head.repo.full_name,
        createdAt: data.created_at,
        cannotMergeReason: data.mergeable
            ? undefined
            : `pr.mergeable="${data.mergeable}"`,
        hasAssignees: !!(data.assignee?.login || is_1.default.nonEmptyArray(data.assignees)),
    };
}
function matchesState(actual, expected) {
    if (expected === types_1.PrState.All) {
        return true;
    }
    if (expected.startsWith('!')) {
        return actual !== expected.substring(1);
    }
    return actual === expected;
}
function findCommentByTopic(comments, topic) {
    return comments.find((c) => c.body.startsWith(`### ${topic}\n\n`)) ?? null;
}
function findCommentByContent(comments, content) {
    return comments.find((c) => c.body.trim() === content) ?? null;
}
function getLabelList() {
    if (config.labelList === null) {
        const repoLabels = helper
            .getRepoLabels(config.repository, {
            useCache: false,
        })
            .then((labels) => {
            logger_1.logger.debug(`Retrieved ${labels.length} repo labels`);
            return labels;
        });
        const orgLabels = helper
            .getOrgLabels(config.repository.split('/')[0], {
            useCache: false,
        })
            .then((labels) => {
            logger_1.logger.debug(`Retrieved ${labels.length} org labels`);
            return labels;
        })
            .catch((err) => {
            // Will fail if owner of repo is not org or Gitea version < 1.12
            logger_1.logger.debug(`Unable to fetch organization labels`);
            return [];
        });
        config.labelList = Promise.all([repoLabels, orgLabels]).then((labels) => [].concat(...labels));
    }
    return config.labelList;
}
async function lookupLabelByName(name) {
    logger_1.logger.debug(`lookupLabelByName(${name})`);
    const labelList = await getLabelList();
    return labelList.find((l) => l.name === name)?.id ?? null;
}
const platform = {
    async initPlatform({ endpoint, token, }) {
        if (!token) {
            throw new Error('Init: You must configure a Gitea personal access token');
        }
        if (endpoint) {
            let baseEndpoint = (0, utils_1.trimTrailingApiPath)(endpoint);
            baseEndpoint = (0, url_1.ensureTrailingSlash)(baseEndpoint);
            defaults.endpoint = baseEndpoint;
        }
        else {
            logger_1.logger.debug('Using default Gitea endpoint: ' + defaults.endpoint);
        }
        (0, gitea_1.setBaseUrl)(defaults.endpoint);
        let gitAuthor;
        try {
            const user = await helper.getCurrentUser({ token });
            gitAuthor = `${user.full_name || user.username} <${user.email}>`;
            botUserID = user.id;
            botUserName = user.username;
            defaults.version = await helper.getVersion({ token });
        }
        catch (err) {
            logger_1.logger.debug({ err }, 'Error authenticating with Gitea. Check your token');
            throw new Error('Init: Authentication failure');
        }
        return {
            endpoint: defaults.endpoint,
            gitAuthor,
        };
    },
    async getRawFile(fileName, repoName, branchOrTag) {
        const repo = repoName ?? config.repository;
        const contents = await helper.getRepoContents(repo, fileName, branchOrTag);
        return contents.contentString ?? null;
    },
    async getJsonFile(fileName, repoName, branchOrTag) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        const raw = (await platform.getRawFile(fileName, repoName, branchOrTag));
        return json5_1.default.parse(raw);
    },
    async initRepo({ repository, cloneSubmodules, gitUrl, }) {
        let repo;
        config = {};
        config.repository = repository;
        config.cloneSubmodules = !!cloneSubmodules;
        // Attempt to fetch information about repository
        try {
            repo = await helper.getRepo(repository);
        }
        catch (err) {
            logger_1.logger.debug({ err }, 'Unknown Gitea initRepo error');
            throw err;
        }
        // Ensure appropriate repository state and permissions
        if (repo.archived) {
            logger_1.logger.debug('Repository is archived - throwing error to abort renovation');
            throw new Error(error_messages_1.REPOSITORY_ARCHIVED);
        }
        if (repo.mirror) {
            logger_1.logger.debug('Repository is a mirror - throwing error to abort renovation');
            throw new Error(error_messages_1.REPOSITORY_MIRRORED);
        }
        if (!repo.permissions.pull || !repo.permissions.push) {
            logger_1.logger.debug('Repository does not permit pull and push - throwing error to abort renovation');
            throw new Error(error_messages_1.REPOSITORY_ACCESS_FORBIDDEN);
        }
        if (repo.empty) {
            logger_1.logger.debug('Repository is empty - throwing error to abort renovation');
            throw new Error(error_messages_1.REPOSITORY_EMPTY);
        }
        if (repo.allow_rebase) {
            config.mergeMethod = 'rebase';
        }
        else if (repo.allow_rebase_explicit) {
            config.mergeMethod = 'rebase-merge';
        }
        else if (repo.allow_squash_merge) {
            config.mergeMethod = 'squash';
        }
        else if (repo.allow_merge_commits) {
            config.mergeMethod = 'merge';
        }
        else {
            logger_1.logger.debug('Repository has no allowed merge methods - throwing error to abort renovation');
            throw new Error(error_messages_1.REPOSITORY_BLOCKED);
        }
        // Determine author email and branches
        config.defaultBranch = repo.default_branch;
        logger_1.logger.debug(`${repository} default branch = ${config.defaultBranch}`);
        const url = (0, utils_1.getRepoUrl)(repo, gitUrl, defaults.endpoint);
        // Initialize Git storage
        await git.initRepo({
            ...config,
            url,
        });
        // Reset cached resources
        config.prList = null;
        config.issueList = null;
        config.labelList = null;
        return {
            defaultBranch: config.defaultBranch,
            isFork: !!repo.fork,
        };
    },
    async getRepos() {
        logger_1.logger.debug('Auto-discovering Gitea repositories');
        try {
            const repos = await helper.searchRepos({
                uid: botUserID,
                archived: false,
            });
            return repos.map((r) => r.full_name);
        }
        catch (err) {
            logger_1.logger.error({ err }, 'Gitea getRepos() error');
            throw err;
        }
    },
    async setBranchStatus({ branchName, context, description, state, url: target_url, }) {
        try {
            // Create new status for branch commit
            const branchCommit = git.getBranchCommit(branchName);
            // TODO: check branchCommit
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            await helper.createCommitStatus(config.repository, branchCommit, {
                state: helper.renovateToGiteaStatusMapping[state] || 'pending',
                context,
                description,
                ...(target_url && { target_url }),
            });
            // Refresh caches by re-fetching commit status for branch
            await helper.getCombinedCommitStatus(config.repository, branchName, {
                useCache: false,
            });
        }
        catch (err) {
            logger_1.logger.warn({ err }, 'Failed to set branch status');
        }
    },
    async getBranchStatus(branchName) {
        let ccs;
        try {
            ccs = await helper.getCombinedCommitStatus(config.repository, branchName);
        }
        catch (err) {
            if (err.statusCode === 404) {
                logger_1.logger.debug('Received 404 when checking branch status, assuming branch deletion');
                throw new Error(error_messages_1.REPOSITORY_CHANGED);
            }
            logger_1.logger.debug('Unknown error when checking branch status');
            throw err;
        }
        logger_1.logger.debug({ ccs }, 'Branch status check result');
        return (helper.giteaToRenovateStatusMapping[ccs.worstStatus] ||
            types_1.BranchStatus.yellow);
    },
    async getBranchStatusCheck(branchName, context) {
        const ccs = await helper.getCombinedCommitStatus(config.repository, branchName);
        const cs = ccs.statuses.find((s) => s.context === context);
        if (!cs) {
            return null;
        } // no status check exists
        const status = helper.giteaToRenovateStatusMapping[cs.status];
        if (status) {
            return status;
        }
        logger_1.logger.warn({ check: cs }, 'Could not map Gitea status value to Renovate status');
        return types_1.BranchStatus.yellow;
    },
    getPrList() {
        if (config.prList === null) {
            config.prList = helper
                .searchPRs(config.repository, { state: types_1.PrState.All }, { useCache: false })
                .then((prs) => {
                const prList = prs.map(toRenovatePR).filter(is_1.default.truthy);
                logger_1.logger.debug(`Retrieved ${prList.length} Pull Requests`);
                return prList;
            });
        }
        return config.prList;
    },
    async getPr(number) {
        // Search for pull request in cached list or attempt to query directly
        const prList = await platform.getPrList();
        let pr = prList.find((p) => p.number === number) ?? null;
        if (pr) {
            logger_1.logger.debug('Returning from cached PRs');
        }
        else {
            logger_1.logger.debug('PR not found in cached PRs - trying to fetch directly');
            const gpr = await helper.getPR(config.repository, number);
            pr = toRenovatePR(gpr);
            // Add pull request to cache for further lookups / queries
            if (config.prList !== null) {
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                (await config.prList).push(pr);
            }
        }
        // Abort and return null if no match was found
        if (!pr) {
            return null;
        }
        return pr;
    },
    async findPr({ branchName, prTitle: title, state = types_1.PrState.All, }) {
        logger_1.logger.debug(`findPr(${branchName}, ${title}, ${state})`);
        const prList = await platform.getPrList();
        const pr = prList.find((p) => p.sourceRepo === config.repository &&
            p.sourceBranch === branchName &&
            matchesState(p.state, state) &&
            (!title || p.title === title));
        if (pr) {
            logger_1.logger.debug(`Found PR #${pr.number}`);
        }
        return pr ?? null;
    },
    async createPr({ sourceBranch, targetBranch, prTitle: title, prBody: rawBody, labels: labelNames, }) {
        const base = targetBranch;
        const head = sourceBranch;
        const body = (0, sanitize_1.sanitize)(rawBody);
        logger_1.logger.debug(`Creating pull request: ${title} (${head} => ${base})`);
        try {
            const labels = Array.isArray(labelNames)
                ? await Promise.all(labelNames.map(lookupLabelByName))
                : [];
            const gpr = await helper.createPR(config.repository, {
                base,
                head,
                title,
                body,
                labels: labels.filter(is_1.default.number),
            });
            const pr = toRenovatePR(gpr);
            if (!pr) {
                throw new Error('Can not parse newly created Pull Request');
            }
            if (config.prList !== null) {
                (await config.prList).push(pr);
            }
            return pr;
        }
        catch (err) {
            // When the user manually deletes a branch from Renovate, the PR remains but is no longer linked to any branch. In
            // the most recent versions of Gitea, the PR gets automatically closed when that happens, but older versions do
            // not handle this properly and keep the PR open. As pushing a branch with the same name resurrects the PR, this
            // would cause a HTTP 409 conflict error, which we hereby gracefully handle.
            if (err.statusCode === 409) {
                logger_1.logger.warn(`Attempting to gracefully recover from 409 Conflict response in createPr(${title}, ${sourceBranch})`);
                // Refresh cached PR list and search for pull request with matching information
                config.prList = null;
                const pr = await platform.findPr({
                    branchName: sourceBranch,
                    state: types_1.PrState.Open,
                });
                // If a valid PR was found, return and gracefully recover from the error. Otherwise, abort and throw error.
                if (pr?.bodyStruct) {
                    if (pr.title !== title || pr.bodyStruct.hash !== (0, pr_body_1.hashBody)(body)) {
                        logger_1.logger.debug(`Recovered from 409 Conflict, but PR for ${sourceBranch} is outdated. Updating...`);
                        await platform.updatePr({
                            number: pr.number,
                            prTitle: title,
                            prBody: body,
                        });
                        pr.title = title;
                        pr.bodyStruct = (0, pr_body_1.getPrBodyStruct)(body);
                    }
                    else {
                        logger_1.logger.debug(`Recovered from 409 Conflict and PR for ${sourceBranch} is up-to-date`);
                    }
                    return pr;
                }
            }
            throw err;
        }
    },
    async updatePr({ number, prTitle: title, prBody: body, state, }) {
        await helper.updatePR(config.repository, number, {
            title,
            ...(body && { body }),
            ...(state && { state }),
        });
    },
    async mergePr({ id }) {
        try {
            await helper.mergePR(config.repository, id, config.mergeMethod);
            return true;
        }
        catch (err) {
            logger_1.logger.warn({ err, id }, 'Merging of PR failed');
            return false;
        }
    },
    getIssueList() {
        if (config.issueList === null) {
            config.issueList = helper
                .searchIssues(config.repository, { state: 'all' }, { useCache: false })
                .then((issues) => {
                const issueList = issues.map(toRenovateIssue);
                logger_1.logger.debug(`Retrieved ${issueList.length} Issues`);
                return issueList;
            });
        }
        return config.issueList;
    },
    async getIssue(number, useCache = true) {
        try {
            const body = (await helper.getIssue(config.repository, number, {
                useCache,
            })).body;
            return {
                number,
                body,
            };
        }
        catch (err) /* istanbul ignore next */ {
            logger_1.logger.debug({ err, number }, 'Error getting issue');
            return null;
        }
    },
    async findIssue(title) {
        const issueList = await platform.getIssueList();
        const issue = issueList.find((i) => i.state === 'open' && i.title === title);
        if (!issue) {
            return null;
        }
        logger_1.logger.debug(`Found Issue #${issue.number}`);
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        return exports.getIssue(issue.number);
    },
    async ensureIssue({ title, reuseTitle, body: content, labels: labelNames, shouldReOpen, once, }) {
        logger_1.logger.debug(`ensureIssue(${title})`);
        try {
            const body = (0, utils_1.smartLinks)(content);
            const issueList = await platform.getIssueList();
            let issues = issueList.filter((i) => i.title === title);
            if (!issues.length) {
                issues = issueList.filter((i) => i.title === reuseTitle);
            }
            const labels = Array.isArray(labelNames)
                ? (await Promise.all(labelNames.map(lookupLabelByName))).filter(is_1.default.number)
                : undefined;
            // Update any matching issues which currently exist
            if (issues.length) {
                let activeIssue = issues.find((i) => i.state === 'open');
                // If no active issue was found, decide if it shall be skipped, re-opened or updated without state change
                if (!activeIssue) {
                    if (once) {
                        logger_1.logger.debug('Issue already closed - skipping update');
                        return null;
                    }
                    if (shouldReOpen) {
                        logger_1.logger.debug('Reopening previously closed Issue');
                    }
                    // Pick the last issue in the list as the active one
                    activeIssue = issues[issues.length - 1];
                }
                // Close any duplicate issues
                for (const issue of issues) {
                    if (issue.state === 'open' && issue.number !== activeIssue.number) {
                        logger_1.logger.warn(`Closing duplicate Issue #${issue.number}`);
                        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                        await helper.closeIssue(config.repository, issue.number);
                    }
                }
                // Check if issue has already correct state
                if (activeIssue.title === title &&
                    activeIssue.body === body &&
                    activeIssue.state === 'open') {
                    logger_1.logger.debug(`Issue #${activeIssue.number} is open and up to date - nothing to do`);
                    return null;
                }
                // Update issue body and re-open if enabled
                logger_1.logger.debug(`Updating Issue #${activeIssue.number}`);
                const existingIssue = await helper.updateIssue(config.repository, 
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                activeIssue.number, {
                    body,
                    title,
                    state: shouldReOpen
                        ? 'open'
                        : activeIssue.state,
                });
                // Test whether the issues need to be updated
                const existingLabelIds = (existingIssue.labels ?? []).map((label) => label.id);
                if (labels &&
                    (labels.length !== existingLabelIds.length ||
                        labels.filter((labelId) => !existingLabelIds.includes(labelId))
                            .length !== 0)) {
                    await helper.updateIssueLabels(config.repository, 
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                    activeIssue.number, {
                        labels,
                    });
                }
                return 'updated';
            }
            // Create new issue and reset cache
            const issue = await helper.createIssue(config.repository, {
                body,
                title,
                labels,
            });
            logger_1.logger.debug(`Created new Issue #${issue.number}`);
            config.issueList = null;
            return 'created';
        }
        catch (err) {
            logger_1.logger.warn({ err }, 'Could not ensure issue');
        }
        return null;
    },
    async ensureIssueClosing(title) {
        logger_1.logger.debug(`ensureIssueClosing(${title})`);
        const issueList = await platform.getIssueList();
        for (const issue of issueList) {
            if (issue.state === 'open' && issue.title === title) {
                logger_1.logger.debug({ number: issue.number }, 'Closing issue');
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                await helper.closeIssue(config.repository, issue.number);
            }
        }
    },
    async deleteLabel(issue, labelName) {
        logger_1.logger.debug(`Deleting label ${labelName} from Issue #${issue}`);
        const label = await lookupLabelByName(labelName);
        if (label) {
            await helper.unassignLabel(config.repository, issue, label);
        }
        else {
            logger_1.logger.warn({ issue, labelName }, 'Failed to lookup label for deletion');
        }
    },
    getRepoForceRebase() {
        return Promise.resolve(false);
    },
    async ensureComment({ number: issue, topic, content, }) {
        try {
            let body = (0, sanitize_1.sanitize)(content);
            const commentList = await helper.getComments(config.repository, issue);
            // Search comment by either topic or exact body
            let comment = null;
            if (topic) {
                comment = findCommentByTopic(commentList, topic);
                body = `### ${topic}\n\n${body}`;
            }
            else {
                comment = findCommentByContent(commentList, body);
            }
            // Create a new comment if no match has been found, otherwise update if necessary
            if (!comment) {
                comment = await helper.createComment(config.repository, issue, body);
                logger_1.logger.info({ repository: config.repository, issue, comment: comment.id }, 'Comment added');
            }
            else if (comment.body === body) {
                logger_1.logger.debug(`Comment #${comment.id} is already up-to-date`);
            }
            else {
                await helper.updateComment(config.repository, comment.id, body);
                logger_1.logger.debug({ repository: config.repository, issue, comment: comment.id }, 'Comment updated');
            }
            return true;
        }
        catch (err) {
            logger_1.logger.warn({ err, issue, subject: topic }, 'Error ensuring comment');
            return false;
        }
    },
    async ensureCommentRemoval(deleteConfig) {
        const { number: issue } = deleteConfig;
        const key = deleteConfig.type === 'by-topic'
            ? deleteConfig.topic
            : deleteConfig.content;
        logger_1.logger.debug(`Ensuring comment "${key}" in #${issue} is removed`);
        const commentList = await helper.getComments(config.repository, issue);
        let comment = null;
        if (deleteConfig.type === 'by-topic') {
            comment = findCommentByTopic(commentList, deleteConfig.topic);
        }
        else if (deleteConfig.type === 'by-content') {
            const body = (0, sanitize_1.sanitize)(deleteConfig.content);
            comment = findCommentByContent(commentList, body);
        }
        // Abort and do nothing if no matching comment was found
        if (!comment) {
            return;
        }
        // Attempt to delete comment
        try {
            await helper.deleteComment(config.repository, comment.id);
        }
        catch (err) {
            logger_1.logger.warn({ err, issue, config: deleteConfig }, 'Error deleting comment');
        }
    },
    async getBranchPr(branchName) {
        logger_1.logger.debug(`getBranchPr(${branchName})`);
        const pr = await platform.findPr({ branchName, state: types_1.PrState.Open });
        return pr ? platform.getPr(pr.number) : null;
    },
    async addAssignees(number, assignees) {
        logger_1.logger.debug(`Updating assignees '${assignees?.join(', ')}' on Issue #${number}`);
        await helper.updateIssue(config.repository, number, {
            assignees,
        });
    },
    async addReviewers(number, reviewers) {
        logger_1.logger.debug(`Adding reviewers '${reviewers?.join(', ')}' to #${number}`);
        if (semver_1.default.lt(defaults.version, '1.14.0')) {
            logger_1.logger.debug({ version: defaults.version }, 'Adding reviewer not yet supported.');
            return;
        }
        try {
            await helper.requestPrReviewers(config.repository, number, { reviewers });
        }
        catch (err) {
            logger_1.logger.warn({ err, number, reviewers }, 'Failed to assign reviewer');
        }
    },
    massageMarkdown(prBody) {
        return (0, pr_body_2.smartTruncate)((0, utils_1.smartLinks)(prBody), 1000000);
    },
    getVulnerabilityAlerts() {
        return Promise.resolve([]);
    },
};
// eslint-disable-next-line @typescript-eslint/unbound-method
exports.addAssignees = platform.addAssignees, exports.addReviewers = platform.addReviewers, exports.createPr = platform.createPr, exports.deleteLabel = platform.deleteLabel, exports.ensureComment = platform.ensureComment, exports.ensureCommentRemoval = platform.ensureCommentRemoval, exports.ensureIssue = platform.ensureIssue, exports.ensureIssueClosing = platform.ensureIssueClosing, exports.findIssue = platform.findIssue, exports.findPr = platform.findPr, exports.getBranchPr = platform.getBranchPr, exports.getBranchStatus = platform.getBranchStatus, exports.getBranchStatusCheck = platform.getBranchStatusCheck, exports.getIssue = platform.getIssue, exports.getRawFile = platform.getRawFile, exports.getJsonFile = platform.getJsonFile, exports.getIssueList = platform.getIssueList, exports.getPr = platform.getPr, exports.massageMarkdown = platform.massageMarkdown, exports.getPrList = platform.getPrList, exports.getRepoForceRebase = platform.getRepoForceRebase, exports.getRepos = platform.getRepos, exports.getVulnerabilityAlerts = platform.getVulnerabilityAlerts, exports.initPlatform = platform.initPlatform, exports.initRepo = platform.initRepo, exports.mergePr = platform.mergePr, exports.setBranchStatus = platform.setBranchStatus, exports.updatePr = platform.updatePr;
//# sourceMappingURL=index.js.map