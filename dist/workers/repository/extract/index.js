"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractAllDependencies = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const config_1 = require("../../../config");
const logger_1 = require("../../../logger");
const manager_1 = require("../../../modules/manager");
const git_1 = require("../../../util/git");
const file_match_1 = require("./file-match");
const manager_files_1 = require("./manager-files");
async function extractAllDependencies(config) {
    let managerList = (0, manager_1.getManagerList)();
    const { enabledManagers } = config;
    if (is_1.default.nonEmptyArray(enabledManagers)) {
        logger_1.logger.debug('Applying enabledManagers filtering');
        managerList = managerList.filter((manager) => enabledManagers.includes(manager));
    }
    const extractList = [];
    const fileList = await (0, git_1.getFileList)();
    const tryConfig = (managerConfig) => {
        const matchingFileList = (0, file_match_1.getMatchingFiles)(managerConfig, fileList);
        if (matchingFileList.length) {
            extractList.push({ ...managerConfig, fileList: matchingFileList });
        }
    };
    for (const manager of managerList) {
        const managerConfig = (0, config_1.getManagerConfig)(config, manager);
        managerConfig.manager = manager;
        if (manager === 'regex') {
            for (const regexManager of config.regexManagers ?? []) {
                tryConfig((0, config_1.mergeChildConfig)(managerConfig, regexManager));
            }
        }
        else {
            tryConfig(managerConfig);
        }
    }
    const extractResults = await Promise.all(extractList.map(async (managerConfig) => {
        const packageFiles = await (0, manager_files_1.getManagerPackageFiles)(managerConfig);
        for (const p of packageFiles ?? []) {
            for (const dep of p.deps ?? []) {
                if (!config.updateInternalDeps && dep.isInternal) {
                    dep.skipReason = 'internal-package';
                }
            }
        }
        return { manager: managerConfig.manager, packageFiles };
    }));
    const extractions = {};
    let fileCount = 0;
    for (const { manager, packageFiles } of extractResults) {
        if (packageFiles?.length) {
            fileCount += packageFiles.length;
            logger_1.logger.debug(`Found ${manager} package files`);
            extractions[manager] = (extractions[manager] || []).concat(packageFiles);
        }
    }
    logger_1.logger.debug(`Found ${fileCount} package file(s)`);
    // If enabledManagers is non-empty, check that each of them has at least one extraction.
    // If not, log a warning to indicate possible misconfiguration.
    if (is_1.default.nonEmptyArray(config.enabledManagers)) {
        for (const enabledManager of config.enabledManagers) {
            if (!(enabledManager in extractions)) {
                logger_1.logger.debug({ manager: enabledManager }, `Manager explicitly enabled in "enabledManagers" config, but found no results. Possible config error?`);
            }
        }
    }
    return extractions;
}
exports.extractAllDependencies = extractAllDependencies;
//# sourceMappingURL=index.js.map