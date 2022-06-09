"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchUpdates = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const p_all_1 = tslib_1.__importDefault(require("p-all"));
const config_1 = require("../../../config");
const logger_1 = require("../../../logger");
const datasource_1 = require("../../../modules/datasource");
const clone_1 = require("../../../util/clone");
const package_rules_1 = require("../../../util/package-rules");
const package_files_1 = require("../package-files");
const lookup_1 = require("./lookup");
async function fetchDepUpdates(packageFileConfig, indep) {
    let dep = (0, clone_1.clone)(indep);
    dep.updates = [];
    if (is_1.default.string(dep.depName)) {
        dep.depName = dep.depName.trim();
    }
    if (!is_1.default.nonEmptyString(dep.depName)) {
        dep.skipReason = 'invalid-name';
    }
    if (dep.skipReason) {
        return dep;
    }
    const { depName } = dep;
    // TODO: fix types
    let depConfig = (0, config_1.mergeChildConfig)(packageFileConfig, dep);
    const datasourceDefaultConfig = await (0, datasource_1.getDefaultConfig)(depConfig.datasource);
    depConfig = (0, config_1.mergeChildConfig)(depConfig, datasourceDefaultConfig);
    depConfig = (0, package_rules_1.applyPackageRules)(depConfig);
    if (depConfig.ignoreDeps.includes(depName)) {
        logger_1.logger.debug({ dependency: depName }, 'Dependency is ignored');
        dep.skipReason = 'ignored';
    }
    else if (depConfig.enabled === false) {
        logger_1.logger.debug({ dependency: depName }, 'Dependency is disabled');
        dep.skipReason = 'disabled';
    }
    else {
        if (depConfig.datasource) {
            dep = {
                ...dep,
                ...(await (0, lookup_1.lookupUpdates)(depConfig)),
            };
        }
        dep.updates = dep.updates || [];
    }
    return dep;
}
async function fetchManagerPackagerFileUpdates(config, managerConfig, pFile) {
    const { packageFile } = pFile;
    const packageFileConfig = (0, config_1.mergeChildConfig)(managerConfig, pFile);
    const { manager } = packageFileConfig;
    const queue = pFile.deps.map((dep) => () => fetchDepUpdates(packageFileConfig, dep));
    logger_1.logger.trace({ manager, packageFile, queueLength: queue.length }, 'fetchManagerPackagerFileUpdates starting with concurrency');
    pFile.deps = await (0, p_all_1.default)(queue, { concurrency: 5 });
    logger_1.logger.trace({ packageFile }, 'fetchManagerPackagerFileUpdates finished');
}
async function fetchManagerUpdates(config, packageFiles, manager) {
    const managerConfig = (0, config_1.getManagerConfig)(config, manager);
    const queue = packageFiles[manager].map((pFile) => () => fetchManagerPackagerFileUpdates(config, managerConfig, pFile));
    logger_1.logger.trace({ manager, queueLength: queue.length }, 'fetchManagerUpdates starting');
    await (0, p_all_1.default)(queue, { concurrency: 5 });
    logger_1.logger.trace({ manager }, 'fetchManagerUpdates finished');
}
async function fetchUpdates(config, packageFiles) {
    const managers = Object.keys(packageFiles);
    const allManagerJobs = managers.map((manager) => fetchManagerUpdates(config, packageFiles, manager));
    await Promise.all(allManagerJobs);
    package_files_1.PackageFiles.add(config.baseBranch, { ...packageFiles });
    logger_1.logger.debug({ baseBranch: config.baseBranch }, 'Package releases lookups complete');
}
exports.fetchUpdates = fetchUpdates;
//# sourceMappingURL=fetch.js.map