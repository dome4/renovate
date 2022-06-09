"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.finaliseRepo = void 0;
const tslib_1 = require("tslib");
const logger_1 = require("../../../logger");
const platform_1 = require("../../../modules/platform");
const repositoryCache = tslib_1.__importStar(require("../../../util/cache/repository"));
const git_1 = require("../../../util/git");
const package_files_1 = require("../package-files");
const prune_1 = require("./prune");
const repository_statistics_1 = require("./repository-statistics");
// istanbul ignore next
async function finaliseRepo(config, branchList) {
    await repositoryCache.saveCache();
    await (0, prune_1.pruneStaleBranches)(config, branchList);
    await platform_1.platform.ensureIssueClosing(`Action Required: Fix Renovate Configuration`);
    await (0, git_1.clearRenovateRefs)();
    package_files_1.PackageFiles.clear();
    const prList = await platform_1.platform.getPrList();
    if (prList?.some((pr) => pr.state === 'merged' &&
        pr.title !== 'Configure Renovate' &&
        pr.title !== config.onboardingPrTitle)) {
        logger_1.logger.debug('Repo is activated');
        config.repoIsActivated = true;
    }
    (0, repository_statistics_1.runRenovateRepoStats)(config, prList);
}
exports.finaliseRepo = finaliseRepo;
//# sourceMappingURL=index.js.map