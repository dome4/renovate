"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.flattenUpdates = exports.applyUpdateConfig = void 0;
const config_1 = require("../../../config");
const datasource_1 = require("../../../modules/datasource");
const manager_1 = require("../../../modules/manager");
const package_rules_1 = require("../../../util/package-rules");
const regex_1 = require("../../../util/regex");
const url_1 = require("../../../util/url");
const branch_name_1 = require("./branch-name");
const upper = (str) => str.charAt(0).toUpperCase() + str.substr(1);
function sanitizeDepName(depName) {
    return depName
        .replace('@types/', '')
        .replace('@', '')
        .replace((0, regex_1.regEx)(/\//g), '-')
        .replace((0, regex_1.regEx)(/\s+/g), '-')
        .replace((0, regex_1.regEx)(/-+/), '-')
        .toLowerCase();
}
function applyUpdateConfig(input) {
    const updateConfig = { ...input };
    delete updateConfig.packageRules;
    // TODO: Remove next line once #8075 is complete
    updateConfig.depNameSanitized = updateConfig.depName
        ? sanitizeDepName(updateConfig.depName)
        : undefined;
    updateConfig.newNameSanitized = updateConfig.newName
        ? sanitizeDepName(updateConfig.newName)
        : undefined;
    if (updateConfig.sourceUrl) {
        const parsedSourceUrl = (0, url_1.parseUrl)(updateConfig.sourceUrl);
        if (parsedSourceUrl?.pathname) {
            updateConfig.sourceRepoSlug = parsedSourceUrl.pathname
                .replace((0, regex_1.regEx)(/^\//), '') // remove leading slash
                .replace((0, regex_1.regEx)(/\//g), '-') // change slashes to hyphens
                .replace((0, regex_1.regEx)(/-+/g), '-'); // remove multiple hyphens
            updateConfig.sourceRepo = parsedSourceUrl.pathname.replace((0, regex_1.regEx)(/^\//), ''); // remove leading slash
            updateConfig.sourceRepoOrg = updateConfig.sourceRepo.replace((0, regex_1.regEx)(/\/.*/g), ''); // remove everything after first slash
            updateConfig.sourceRepoName = updateConfig.sourceRepo.replace((0, regex_1.regEx)(/.*\//g), ''); // remove everything up to the last slash
        }
    }
    (0, branch_name_1.generateBranchName)(updateConfig);
    return updateConfig;
}
exports.applyUpdateConfig = applyUpdateConfig;
async function flattenUpdates(config, packageFiles) {
    const updates = [];
    const updateTypes = [
        'major',
        'minor',
        'patch',
        'pin',
        'digest',
        'lockFileMaintenance',
        'replacement',
    ];
    for (const [manager, files] of Object.entries(packageFiles)) {
        const managerConfig = (0, config_1.getManagerConfig)(config, manager);
        for (const packageFile of files) {
            const packageFileConfig = (0, config_1.mergeChildConfig)(managerConfig, packageFile);
            const packagePath = packageFile.packageFile?.split('/');
            // istanbul ignore else: can never happen and would throw
            if (packagePath.length > 0) {
                packagePath.splice(-1, 1);
            }
            if (packagePath.length > 0) {
                packageFileConfig.parentDir = packagePath[packagePath.length - 1];
                packageFileConfig.packageFileDir = packagePath.join('/');
            }
            else {
                packageFileConfig.parentDir = '';
                packageFileConfig.packageFileDir = '';
            }
            for (const dep of packageFile.deps) {
                if (dep.updates.length) {
                    const depConfig = (0, config_1.mergeChildConfig)(packageFileConfig, dep);
                    delete depConfig.deps;
                    for (const update of dep.updates) {
                        let updateConfig = (0, config_1.mergeChildConfig)(depConfig, update);
                        delete updateConfig.updates;
                        if (updateConfig.updateType) {
                            updateConfig[`is${upper(updateConfig.updateType)}`] = true;
                        }
                        if (updateConfig.updateTypes) {
                            updateConfig.updateTypes.forEach((updateType) => {
                                updateConfig[`is${upper(updateType)}`] = true;
                            });
                        }
                        // apply config from datasource
                        const datasourceConfig = await (0, datasource_1.getDefaultConfig)(depConfig.datasource);
                        updateConfig = (0, config_1.mergeChildConfig)(updateConfig, datasourceConfig);
                        updateConfig = (0, package_rules_1.applyPackageRules)(updateConfig);
                        // apply major/minor/patch/pin/digest
                        updateConfig = (0, config_1.mergeChildConfig)(updateConfig, updateConfig[updateConfig.updateType]);
                        for (const updateType of updateTypes) {
                            delete updateConfig[updateType];
                        }
                        // Apply again in case any were added by the updateType config
                        updateConfig = (0, package_rules_1.applyPackageRules)(updateConfig);
                        updateConfig = applyUpdateConfig(updateConfig);
                        updateConfig.baseDeps = packageFile.deps;
                        update.branchName = updateConfig.branchName;
                        updates.push(updateConfig);
                    }
                }
            }
            if ((0, manager_1.get)(manager, 'supportsLockFileMaintenance') &&
                packageFileConfig.lockFileMaintenance.enabled) {
                // Apply lockFileMaintenance config before packageRules
                let lockFileConfig = (0, config_1.mergeChildConfig)(packageFileConfig, packageFileConfig.lockFileMaintenance);
                lockFileConfig.updateType = 'lockFileMaintenance';
                lockFileConfig.isLockFileMaintenance = true;
                lockFileConfig = (0, package_rules_1.applyPackageRules)(lockFileConfig);
                // Apply lockFileMaintenance and packageRules again
                lockFileConfig = (0, config_1.mergeChildConfig)(lockFileConfig, lockFileConfig.lockFileMaintenance);
                lockFileConfig = (0, package_rules_1.applyPackageRules)(lockFileConfig);
                // Remove unnecessary objects
                for (const updateType of updateTypes) {
                    delete lockFileConfig[updateType];
                }
                delete lockFileConfig.packageRules;
                delete lockFileConfig.deps;
                (0, branch_name_1.generateBranchName)(lockFileConfig);
                updates.push(lockFileConfig);
            }
            if ((0, manager_1.get)(manager, 'updateLockedDependency')) {
                for (const lockFile of packageFileConfig.lockFiles || []) {
                    const remediations = config.remediations?.[lockFile];
                    if (remediations) {
                        for (const remediation of remediations) {
                            let updateConfig = (0, config_1.mergeChildConfig)(packageFileConfig, remediation);
                            updateConfig = (0, config_1.mergeChildConfig)(updateConfig, config.vulnerabilityAlerts);
                            delete updateConfig.vulnerabilityAlerts;
                            updateConfig.isVulnerabilityAlert = true;
                            updateConfig.isRemediation = true;
                            updateConfig.lockFile = lockFile;
                            updateConfig.currentValue = updateConfig.currentVersion;
                            updateConfig.newValue = updateConfig.newVersion;
                            updateConfig = applyUpdateConfig(updateConfig);
                            updateConfig.enabled = true;
                            updates.push(updateConfig);
                        }
                    }
                }
            }
        }
    }
    return updates
        .filter((update) => update.enabled)
        .map(({ vulnerabilityAlerts, ...update }) => update)
        .map((update) => (0, config_1.filterConfig)(update, 'branch'));
}
exports.flattenUpdates = flattenUpdates;
//# sourceMappingURL=flatten.js.map