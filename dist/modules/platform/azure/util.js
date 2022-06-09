"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRepoByName = exports.getProjectAndRepo = exports.max4000Chars = exports.getStorageExtraCloneOpts = exports.getRenovatePRFormat = exports.getBranchNameWithoutRefsPrefix = exports.getBranchNameWithoutRefsheadsPrefix = exports.getGitStatusContextFromCombinedName = exports.getGitStatusContextCombinedName = exports.getNewBranchName = void 0;
const GitInterfaces_js_1 = require("azure-devops-node-api/interfaces/GitInterfaces.js");
const logger_1 = require("../../../logger");
const types_1 = require("../../../types");
const sanitize_1 = require("../../../util/sanitize");
const string_1 = require("../../../util/string");
const pr_body_1 = require("../pr-body");
function getNewBranchName(branchName) {
    if (branchName && !branchName.startsWith('refs/heads/')) {
        return `refs/heads/${branchName}`;
    }
    return branchName;
}
exports.getNewBranchName = getNewBranchName;
function getGitStatusContextCombinedName(context) {
    if (!context) {
        return undefined;
    }
    const combinedName = `${context.genre ? `${context.genre}/` : ''}${context.name}`;
    logger_1.logger.trace(`Got combined context name of ${combinedName}`);
    return combinedName;
}
exports.getGitStatusContextCombinedName = getGitStatusContextCombinedName;
function getGitStatusContextFromCombinedName(context) {
    if (!context) {
        return undefined;
    }
    let name = context;
    let genre;
    const lastSlash = context.lastIndexOf('/');
    if (lastSlash > 0) {
        name = context.substring(lastSlash + 1);
        genre = context.substring(0, lastSlash);
    }
    return {
        genre,
        name,
    };
}
exports.getGitStatusContextFromCombinedName = getGitStatusContextFromCombinedName;
function getBranchNameWithoutRefsheadsPrefix(branchPath) {
    if (!branchPath) {
        logger_1.logger.error(`getBranchNameWithoutRefsheadsPrefix(${branchPath})`);
        return undefined;
    }
    if (!branchPath.startsWith('refs/heads/')) {
        logger_1.logger.trace(`The refs/heads/ name should have started with 'refs/heads/' but it didn't. (${branchPath})`);
        return branchPath;
    }
    return branchPath.substring(11, branchPath.length);
}
exports.getBranchNameWithoutRefsheadsPrefix = getBranchNameWithoutRefsheadsPrefix;
function getBranchNameWithoutRefsPrefix(branchPath) {
    if (!branchPath) {
        logger_1.logger.error(`getBranchNameWithoutRefsPrefix(${branchPath})`);
        return undefined;
    }
    if (!branchPath.startsWith('refs/')) {
        logger_1.logger.trace(`The ref name should have started with 'refs/' but it didn't. (${branchPath})`);
        return branchPath;
    }
    return branchPath.substring(5, branchPath.length);
}
exports.getBranchNameWithoutRefsPrefix = getBranchNameWithoutRefsPrefix;
const stateMap = {
    [GitInterfaces_js_1.PullRequestStatus.Abandoned]: types_1.PrState.Closed,
    [GitInterfaces_js_1.PullRequestStatus.Completed]: types_1.PrState.Merged,
};
function getRenovatePRFormat(azurePr) {
    const number = azurePr.pullRequestId;
    const displayNumber = `Pull Request #${number}`;
    const sourceBranch = getBranchNameWithoutRefsheadsPrefix(azurePr.sourceRefName);
    const targetBranch = getBranchNameWithoutRefsheadsPrefix(azurePr.targetRefName);
    const bodyStruct = (0, pr_body_1.getPrBodyStruct)(azurePr.description);
    const createdAt = azurePr.creationDate?.toISOString();
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const state = stateMap[azurePr.status] ?? types_1.PrState.Open;
    const sourceRefName = azurePr.sourceRefName;
    return {
        ...azurePr,
        sourceBranch,
        state,
        number,
        displayNumber,
        bodyStruct,
        sourceRefName,
        targetBranch,
        createdAt,
    };
}
exports.getRenovatePRFormat = getRenovatePRFormat;
function getStorageExtraCloneOpts(config) {
    let authType;
    let authValue;
    if (!config.token && config.username && config.password) {
        authType = 'basic';
        authValue = (0, string_1.toBase64)(`${config.username}:${config.password}`);
    }
    else if (config.token?.length === 52) {
        authType = 'basic';
        authValue = (0, string_1.toBase64)(`:${config.token}`);
    }
    else {
        authType = 'bearer';
        authValue = config.token;
    }
    (0, sanitize_1.addSecretForSanitizing)(authValue, 'global');
    return {
        '-c': `http.extraheader=AUTHORIZATION: ${authType} ${authValue}`,
    };
}
exports.getStorageExtraCloneOpts = getStorageExtraCloneOpts;
function max4000Chars(str) {
    if (str && str.length >= 4000) {
        return str.substring(0, 3999);
    }
    return str;
}
exports.max4000Chars = max4000Chars;
function getProjectAndRepo(str) {
    logger_1.logger.trace(`getProjectAndRepo(${str})`);
    const strSplit = str.split(`/`);
    if (strSplit.length === 1) {
        return {
            project: str,
            repo: str,
        };
    }
    if (strSplit.length === 2) {
        return {
            project: strSplit[0],
            repo: strSplit[1],
        };
    }
    const msg = `${str} can be only structured this way : 'repository' or 'projectName/repository'!`;
    logger_1.logger.error(msg);
    throw new Error(msg);
}
exports.getProjectAndRepo = getProjectAndRepo;
function getRepoByName(name, repos) {
    logger_1.logger.trace(`getRepoByName(${name})`);
    let { project, repo } = getProjectAndRepo(name);
    project = project.toLowerCase();
    repo = repo.toLowerCase();
    return (repos?.find((r) => project === r?.project?.name?.toLowerCase() &&
        repo === r?.name?.toLowerCase()) || null);
}
exports.getRepoByName = getRepoByName;
//# sourceMappingURL=util.js.map