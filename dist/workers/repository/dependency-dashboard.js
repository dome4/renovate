"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDependencyDashboard = exports.readDashboardBody = void 0;
const tslib_1 = require("tslib");
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const bunyan_1 = require("bunyan");
const global_1 = require("../../config/global");
const logger_1 = require("../../logger");
const platform_1 = require("../../modules/platform");
const regex_1 = require("../../util/regex");
const template = tslib_1.__importStar(require("../../util/template"));
const types_1 = require("../types");
const package_files_1 = require("./package-files");
function parseDashboardIssue(issueBody) {
    const checkMatch = ' - \\[x\\] <!-- ([a-zA-Z]+)-branch=([^\\s]+) -->';
    const checked = issueBody.match((0, regex_1.regEx)(checkMatch, 'g'));
    const dependencyDashboardChecks = {};
    if (checked?.length) {
        const re = (0, regex_1.regEx)(checkMatch);
        checked.forEach((check) => {
            const [, type, branchName] = re.exec(check);
            dependencyDashboardChecks[branchName] = type;
        });
    }
    const checkedRebaseAll = issueBody.includes(' - [x] <!-- rebase-all-open-prs -->');
    let dependencyDashboardRebaseAllOpen = false;
    if (checkedRebaseAll) {
        dependencyDashboardRebaseAllOpen = true;
    }
    return { dependencyDashboardChecks, dependencyDashboardRebaseAllOpen };
}
async function readDashboardBody(config) {
    config.dependencyDashboardChecks = {};
    const stringifiedConfig = JSON.stringify(config);
    if (config.dependencyDashboard ||
        stringifiedConfig.includes('"dependencyDashboardApproval":true') ||
        stringifiedConfig.includes('"prCreation":"approval"')) {
        config.dependencyDashboardTitle =
            config.dependencyDashboardTitle || `Dependency Dashboard`;
        const issue = await platform_1.platform.findIssue(config.dependencyDashboardTitle);
        if (issue) {
            config.dependencyDashboardIssue = issue.number;
            Object.assign(config, parseDashboardIssue(issue.body));
        }
    }
}
exports.readDashboardBody = readDashboardBody;
function getListItem(branch, type) {
    let item = ' - [ ] ';
    item += `<!-- ${type}-branch=${branch.branchName} -->`;
    if (branch.prNo) {
        item += `[${branch.prTitle}](../pull/${branch.prNo})`;
    }
    else {
        item += branch.prTitle;
    }
    const uniquePackages = [
        ...new Set(branch.upgrades.map((upgrade) => '`' + upgrade.depName + '`')),
    ];
    if (uniquePackages.length < 2) {
        return item + '\n';
    }
    return item + ' (' + uniquePackages.join(', ') + ')\n';
}
function appendRepoProblems(config, issueBody) {
    let newIssueBody = issueBody;
    const repoProblems = new Set((0, logger_1.getProblems)()
        .filter((problem) => problem.repository === config.repository && !problem.artifactErrors)
        .map((problem) => `${bunyan_1.nameFromLevel[problem.level].toUpperCase()}: ${problem.msg}`));
    if (repoProblems.size) {
        newIssueBody += '## Repository problems\n\n';
        newIssueBody +=
            'These problems occurred while renovating this repository.\n\n';
        for (const repoProblem of repoProblems) {
            newIssueBody += ` - ${repoProblem}\n`;
        }
        newIssueBody += '\n';
    }
    return newIssueBody;
}
async function ensureDependencyDashboard(config, allBranches) {
    // legacy/migrated issue
    const reuseTitle = 'Update Dependencies (Renovate Bot)';
    const branches = allBranches.filter((branch) => branch.result !== types_1.BranchResult.Automerged &&
        !branch.upgrades?.every((upgrade) => upgrade.remediationNotPossible));
    if (!(config.dependencyDashboard ||
        config.dependencyDashboardApproval ||
        config.packageRules?.some((rule) => rule.dependencyDashboardApproval) ||
        branches.some((branch) => branch.dependencyDashboardApproval ||
            branch.dependencyDashboardPrApproval))) {
        if (global_1.GlobalConfig.get('dryRun')) {
            logger_1.logger.info({ title: config.dependencyDashboardTitle }, 'DRY-RUN: Would close Dependency Dashboard');
        }
        else {
            logger_1.logger.debug('Closing Dependency Dashboard');
            await platform_1.platform.ensureIssueClosing(config.dependencyDashboardTitle);
        }
        return;
    }
    // istanbul ignore if
    if (config.repoIsOnboarded === false) {
        logger_1.logger.debug('Repo is onboarding - skipping dependency dashboard');
        return;
    }
    logger_1.logger.debug('Ensuring Dependency Dashboard');
    const hasBranches = is_1.default.nonEmptyArray(branches);
    if (config.dependencyDashboardAutoclose && !hasBranches) {
        if (global_1.GlobalConfig.get('dryRun')) {
            logger_1.logger.info({ title: config.dependencyDashboardTitle }, 'DRY-RUN: Would close Dependency Dashboard');
        }
        else {
            logger_1.logger.debug('Closing Dependency Dashboard');
            await platform_1.platform.ensureIssueClosing(config.dependencyDashboardTitle);
        }
        return;
    }
    let issueBody = '';
    if (config.dependencyDashboardHeader?.length) {
        issueBody +=
            template.compile(config.dependencyDashboardHeader, config) + '\n\n';
    }
    issueBody = appendRepoProblems(config, issueBody);
    const pendingApprovals = branches.filter((branch) => branch.result === types_1.BranchResult.NeedsApproval);
    if (pendingApprovals.length) {
        issueBody += '## Pending Approval\n\n';
        issueBody += `These branches will be created by Renovate only once you click their checkbox below.\n\n`;
        for (const branch of pendingApprovals) {
            issueBody += getListItem(branch, 'approve');
        }
        issueBody += '\n';
    }
    const awaitingSchedule = branches.filter((branch) => branch.result === types_1.BranchResult.NotScheduled);
    if (awaitingSchedule.length) {
        issueBody += '## Awaiting Schedule\n\n';
        issueBody +=
            'These updates are awaiting their schedule. Click on a checkbox to get an update now.\n\n';
        for (const branch of awaitingSchedule) {
            issueBody += getListItem(branch, 'unschedule');
        }
        issueBody += '\n';
    }
    const rateLimited = branches.filter((branch) => branch.result === types_1.BranchResult.BranchLimitReached ||
        branch.result === types_1.BranchResult.PrLimitReached ||
        branch.result === types_1.BranchResult.CommitLimitReached);
    if (rateLimited.length) {
        issueBody += '## Rate Limited\n\n';
        issueBody +=
            'These updates are currently rate limited. Click on a checkbox below to force their creation now.\n\n';
        for (const branch of rateLimited) {
            issueBody += getListItem(branch, 'unlimit');
        }
        issueBody += '\n';
    }
    const errorList = branches.filter((branch) => branch.result === types_1.BranchResult.Error);
    if (errorList.length) {
        issueBody += '## Errored\n\n';
        issueBody +=
            'These updates encountered an error and will be retried. Click on a checkbox below to force a retry now.\n\n';
        for (const branch of errorList) {
            issueBody += getListItem(branch, 'retry');
        }
        issueBody += '\n';
    }
    const awaitingPr = branches.filter((branch) => branch.result === types_1.BranchResult.NeedsPrApproval);
    if (awaitingPr.length) {
        issueBody += '## PR Creation Approval Required\n\n';
        issueBody +=
            "These branches exist but PRs won't be created until you approve them by clicking on a checkbox.\n\n";
        for (const branch of awaitingPr) {
            issueBody += getListItem(branch, 'approvePr');
        }
        issueBody += '\n';
    }
    const prEdited = branches.filter((branch) => branch.result === types_1.BranchResult.PrEdited);
    if (prEdited.length) {
        issueBody += '## Edited/Blocked\n\n';
        issueBody += `These updates have been manually edited so Renovate will no longer make changes. To discard all commits and start over, click on a checkbox.\n\n`;
        for (const branch of prEdited) {
            issueBody += getListItem(branch, 'rebase');
        }
        issueBody += '\n';
    }
    const prPending = branches.filter((branch) => branch.result === types_1.BranchResult.Pending);
    if (prPending.length) {
        issueBody += '## Pending Status Checks\n\n';
        issueBody += `These updates await pending status checks. To force their creation now, click the checkbox below.\n\n`;
        for (const branch of prPending) {
            issueBody += getListItem(branch, 'approvePr');
        }
        issueBody += '\n';
    }
    const prPendingBranchAutomerge = branches.filter((branch) => branch.prBlockedBy === 'BranchAutomerge');
    if (prPendingBranchAutomerge.length) {
        issueBody += '## Pending Branch Automerge\n\n';
        issueBody += `These updates await pending status checks before automerging. Click on a checkbox to abort the branch automerge, and create a PR instead.\n\n`;
        for (const branch of prPendingBranchAutomerge) {
            issueBody += getListItem(branch, 'approvePr');
        }
        issueBody += '\n';
    }
    const otherRes = [
        types_1.BranchResult.Pending,
        types_1.BranchResult.NeedsApproval,
        types_1.BranchResult.NeedsPrApproval,
        types_1.BranchResult.NotScheduled,
        types_1.BranchResult.PrLimitReached,
        types_1.BranchResult.CommitLimitReached,
        types_1.BranchResult.BranchLimitReached,
        types_1.BranchResult.AlreadyExisted,
        types_1.BranchResult.Error,
        types_1.BranchResult.Automerged,
        types_1.BranchResult.PrEdited,
    ];
    let inProgress = branches.filter((branch) => !otherRes.includes(branch.result) &&
        branch.prBlockedBy !== 'BranchAutomerge');
    const otherBranches = inProgress.filter((branch) => branch.prBlockedBy || !branch.prNo);
    // istanbul ignore if
    if (otherBranches.length) {
        issueBody += '## Other Branches\n\n';
        issueBody += `These updates are pending. To force PRs open, click the checkbox below.\n\n`;
        for (const branch of otherBranches) {
            issueBody += getListItem(branch, 'other');
        }
        issueBody += '\n';
    }
    inProgress = inProgress.filter((branch) => branch.prNo && !branch.prBlockedBy);
    if (inProgress.length) {
        issueBody += '## Open\n\n';
        issueBody +=
            'These updates have all been created already. Click a checkbox below to force a retry/rebase of any.\n\n';
        for (const branch of inProgress) {
            issueBody += getListItem(branch, 'rebase');
        }
        if (inProgress.length > 2) {
            issueBody += ' - [ ] ';
            issueBody += '<!-- rebase-all-open-prs -->';
            issueBody += '**Click on this checkbox to rebase all open PRs at once**';
            issueBody += '\n';
        }
        issueBody += '\n';
    }
    const alreadyExisted = branches.filter((branch) => branch.result === types_1.BranchResult.AlreadyExisted);
    if (alreadyExisted.length) {
        issueBody += '## Ignored or Blocked\n\n';
        issueBody +=
            'These are blocked by an existing closed PR and will not be recreated unless you click a checkbox below.\n\n';
        for (const branch of alreadyExisted) {
            issueBody += getListItem(branch, 'recreate');
        }
        issueBody += '\n';
    }
    if (!hasBranches) {
        issueBody +=
            'This repository currently has no open or pending branches.\n\n';
    }
    issueBody += package_files_1.PackageFiles.getDashboardMarkdown(config);
    if (config.dependencyDashboardFooter?.length) {
        issueBody +=
            '---\n' +
                template.compile(config.dependencyDashboardFooter, config) +
                '\n';
    }
    if (config.dependencyDashboardIssue) {
        const updatedIssue = await platform_1.platform.getIssue?.(config.dependencyDashboardIssue, false);
        if (updatedIssue) {
            const { dependencyDashboardChecks } = parseDashboardIssue(updatedIssue.body);
            for (const branchName of Object.keys(config.dependencyDashboardChecks)) {
                delete dependencyDashboardChecks[branchName];
            }
            for (const branchName of Object.keys(dependencyDashboardChecks)) {
                const checkText = `- [ ] <!-- ${dependencyDashboardChecks[branchName]}-branch=${branchName} -->`;
                issueBody = issueBody.replace(checkText, checkText.replace('[ ]', '[x]'));
            }
        }
    }
    if (global_1.GlobalConfig.get('dryRun')) {
        logger_1.logger.info({ title: config.dependencyDashboardTitle }, 'DRY-RUN: Would ensure Dependency Dashboard');
    }
    else {
        await platform_1.platform.ensureIssue({
            title: config.dependencyDashboardTitle,
            reuseTitle,
            body: issueBody,
            labels: config.dependencyDashboardLabels,
            confidential: config.confidential,
        });
    }
}
exports.ensureDependencyDashboard = ensureDependencyDashboard;
//# sourceMappingURL=dependency-dashboard.js.map