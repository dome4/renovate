"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.update = exports.lookup = exports.extract = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const hasha_1 = tslib_1.__importDefault(require("hasha"));
const logger_1 = require("../../../logger");
const repository_1 = require("../../../util/cache/repository");
const git_1 = require("../../../util/git");
const extract_1 = require("../extract");
const branchify_1 = require("../updates/branchify");
const deprecated_1 = require("./deprecated");
const fetch_1 = require("./fetch");
const sort_1 = require("./sort");
const write_1 = require("./write");
// istanbul ignore next
function extractStats(packageFiles) {
    if (!packageFiles) {
        return {};
    }
    const stats = {
        managers: {},
        total: {
            fileCount: 0,
            depCount: 0,
        },
    };
    for (const [manager, managerPackageFiles] of Object.entries(packageFiles)) {
        const fileCount = managerPackageFiles.length;
        let depCount = 0;
        for (const file of managerPackageFiles) {
            depCount += file.deps.length;
        }
        stats.managers[manager] = {
            fileCount,
            depCount,
        };
        stats.total.fileCount += fileCount;
        stats.total.depCount += depCount;
    }
    return stats;
}
async function extract(config) {
    logger_1.logger.debug('extract()');
    const { baseBranch } = config;
    const baseBranchSha = (0, git_1.getBranchCommit)(baseBranch);
    let packageFiles;
    const cache = (0, repository_1.getCache)();
    cache.scan || (cache.scan = {});
    const cachedExtract = cache.scan[baseBranch];
    const configHash = (0, hasha_1.default)(JSON.stringify(config));
    // istanbul ignore if
    if (cachedExtract?.sha === baseBranchSha &&
        cachedExtract?.configHash === configHash) {
        logger_1.logger.debug({ baseBranch, baseBranchSha }, 'Found cached extract');
        packageFiles = cachedExtract.packageFiles;
        try {
            for (const files of Object.values(packageFiles)) {
                for (const file of files) {
                    for (const dep of file.deps) {
                        delete dep.updates;
                    }
                }
            }
            logger_1.logger.debug('Deleted cached dep updates');
        }
        catch (err) {
            logger_1.logger.info({ err }, 'Error deleting cached dep updates');
        }
    }
    else {
        await (0, git_1.checkoutBranch)(baseBranch);
        packageFiles = await (0, extract_1.extractAllDependencies)(config);
        cache.scan[baseBranch] = {
            sha: baseBranchSha,
            configHash,
            packageFiles,
        };
        // Clean up cached branch extracts
        const baseBranches = is_1.default.nonEmptyArray(config.baseBranches)
            ? config.baseBranches
            : [baseBranch];
        Object.keys(cache.scan).forEach((branchName) => {
            if (!baseBranches.includes(branchName)) {
                delete cache.scan[branchName];
            }
        });
    }
    const stats = extractStats(packageFiles);
    logger_1.logger.info({ baseBranch: config.baseBranch, stats }, `Dependency extraction complete`);
    logger_1.logger.trace({ config: packageFiles }, 'packageFiles');
    return packageFiles;
}
exports.extract = extract;
async function lookup(config, packageFiles) {
    await (0, fetch_1.fetchUpdates)(config, packageFiles);
    await (0, deprecated_1.raiseDeprecationWarnings)(config, packageFiles);
    const { branches, branchList } = await (0, branchify_1.branchifyUpgrades)(config, packageFiles);
    logger_1.logger.debug({ config: packageFiles }, 'packageFiles with updates');
    (0, sort_1.sortBranches)(branches);
    return { branches, branchList, packageFiles };
}
exports.lookup = lookup;
async function update(config, branches) {
    let res;
    // istanbul ignore else
    if (config.repoIsOnboarded) {
        res = await (0, write_1.writeUpdates)(config, branches);
    }
    return res;
}
exports.update = update;
//# sourceMappingURL=extract-update.js.map