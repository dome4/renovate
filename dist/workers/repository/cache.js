"use strict";
/* istanbul ignore file */
Object.defineProperty(exports, "__esModule", { value: true });
exports.setBranchCache = void 0;
const logger_1 = require("../../logger");
const platform_1 = require("../../modules/platform");
const repository_1 = require("../../util/cache/repository");
const git_1 = require("../../util/git");
function generateBranchUpgradeCache(upgrade) {
    const { datasource, depName, packageName, fixedVersion, currentVersion, newVersion, currentDigest, newDigest, sourceUrl, } = upgrade;
    const result = {
        datasource,
        depName,
        fixedVersion,
        currentVersion,
        newVersion,
        currentDigest,
        newDigest,
        sourceUrl,
    };
    if (packageName) {
        result.packageName = packageName;
    }
    return result;
}
async function generateBranchCache(branch) {
    const { branchName } = branch;
    try {
        const sha = (0, git_1.getBranchCommit)(branchName) || null;
        let prNo = null;
        let parentSha = null;
        if (sha) {
            parentSha = await (0, git_1.getBranchParentSha)(branchName);
            const branchPr = await platform_1.platform.getBranchPr(branchName);
            if (branchPr) {
                prNo = branchPr.number;
            }
        }
        const automerge = !!branch.automerge;
        let isModified = false;
        if (sha) {
            try {
                isModified = await (0, git_1.isBranchModified)(branchName);
            }
            catch (err) /* istanbul ignore next */ {
                // Do nothing
            }
        }
        const upgrades = branch.upgrades
            ? branch.upgrades.map(generateBranchUpgradeCache)
            : [];
        return {
            branchName,
            sha,
            parentSha,
            prNo,
            automerge,
            isModified,
            upgrades,
        };
    }
    catch (error) {
        const err = error.err || error; // external host error nests err
        const errCodes = [401, 404];
        // istanbul ignore if
        if (errCodes.includes(err.response?.statusCode)) {
            logger_1.logger.warn({ err, branchName }, 'HTTP error generating branch cache');
            return null;
        }
        logger_1.logger.error({ err, branchName }, 'Error generating branch cache');
        return null;
    }
}
async function setBranchCache(branches) {
    const branchCaches = [];
    for (const branch of branches) {
        const branchCache = await generateBranchCache(branch);
        if (branchCache) {
            branchCaches.push(branchCache);
        }
    }
    (0, repository_1.getCache)().branches = branchCaches;
}
exports.setBranchCache = setBranchCache;
//# sourceMappingURL=cache.js.map