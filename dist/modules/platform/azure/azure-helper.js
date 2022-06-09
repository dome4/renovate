"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMergeMethod = exports.getCommitDetails = exports.getFile = exports.getAzureBranchObj = exports.getRefs = void 0;
const tslib_1 = require("tslib");
const GitInterfaces_js_1 = require("azure-devops-node-api/interfaces/GitInterfaces.js");
const logger_1 = require("../../../logger");
const streams_1 = require("../../../util/streams");
const azureApi = tslib_1.__importStar(require("./azure-got-wrapper"));
const util_1 = require("./util");
const mergePolicyGuid = 'fa4e907d-c16b-4a4c-9dfa-4916e5d171ab'; // Magic GUID for merge strategy policy configurations
async function getRefs(repoId, branchName) {
    logger_1.logger.debug(`getRefs(${repoId}, ${branchName})`);
    const azureApiGit = await azureApi.gitApi();
    const refs = await azureApiGit.getRefs(repoId, undefined, (0, util_1.getBranchNameWithoutRefsPrefix)(branchName));
    return refs;
}
exports.getRefs = getRefs;
async function getAzureBranchObj(repoId, branchName, from) {
    const fromBranchName = (0, util_1.getNewBranchName)(from);
    const refs = await getRefs(repoId, fromBranchName);
    if (refs.length === 0) {
        logger_1.logger.debug(`getAzureBranchObj without a valid from, so initial commit.`);
        // TODO: fix undefined
        return {
            name: (0, util_1.getNewBranchName)(branchName),
            oldObjectId: '0000000000000000000000000000000000000000',
        };
    }
    return {
        // TODO: fix undefined
        name: (0, util_1.getNewBranchName)(branchName),
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        oldObjectId: refs[0].objectId,
    };
}
exports.getAzureBranchObj = getAzureBranchObj;
// if no branchName, look globally
async function getFile(repoId, filePath, branchName) {
    logger_1.logger.trace(`getFile(filePath=${filePath}, branchName=${branchName})`);
    const azureApiGit = await azureApi.gitApi();
    const item = await azureApiGit.getItemText(repoId, filePath, undefined, undefined, 0, // because we look for 1 file
    false, false, true, {
        versionType: 0,
        versionOptions: 0,
        version: (0, util_1.getBranchNameWithoutRefsheadsPrefix)(branchName),
    });
    if (item?.readable) {
        const fileContent = await (0, streams_1.streamToString)(item);
        try {
            const jTmp = JSON.parse(fileContent);
            if (jTmp.typeKey === 'GitItemNotFoundException') {
                // file not found
                return null;
            }
            if (jTmp.typeKey === 'GitUnresolvableToCommitException') {
                // branch not found
                return null;
            }
        }
        catch (error) {
            // it 's not a JSON, so I send the content directly with the line under
        }
        return fileContent;
    }
    return null; // no file found
}
exports.getFile = getFile;
async function getCommitDetails(commit, repoId) {
    logger_1.logger.debug(`getCommitDetails(${commit}, ${repoId})`);
    const azureApiGit = await azureApi.gitApi();
    const results = await azureApiGit.getCommit(commit, repoId);
    return results;
}
exports.getCommitDetails = getCommitDetails;
async function getMergeMethod(repoId, project, branchRef, defaultBranch) {
    const isRelevantScope = (scope) => {
        if (scope.matchKind === 'DefaultBranch' &&
            (!branchRef || branchRef === `refs/heads/${defaultBranch}`)) {
            return true;
        }
        if (scope.repositoryId !== repoId) {
            return false;
        }
        if (!branchRef) {
            return true;
        }
        return scope.matchKind === 'Exact'
            ? scope.refName === branchRef
            : // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                branchRef.startsWith(scope.refName);
    };
    const policyConfigurations = (await (await azureApi.policyApi()).getPolicyConfigurations(project))
        .filter((p) => p.settings.scope.some(isRelevantScope) && p.type?.id === mergePolicyGuid)
        .map((p) => p.settings)[0];
    logger_1.logger.trace(`getMergeMethod(${repoId}, ${project}, ${branchRef}) determining mergeMethod from matched policy:\n${JSON.stringify(policyConfigurations, null, 4)}`);
    try {
        // TODO: fix me, wrong types
        return Object.keys(policyConfigurations)
            .map((p) => GitInterfaces_js_1.GitPullRequestMergeStrategy[p.slice(5)])
            .find((p) => p);
    }
    catch (err) {
        return GitInterfaces_js_1.GitPullRequestMergeStrategy.NoFastForward;
    }
}
exports.getMergeMethod = getMergeMethod;
//# sourceMappingURL=azure-helper.js.map