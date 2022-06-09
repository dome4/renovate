"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateLockedDependency = void 0;
const tslib_1 = require("tslib");
const detect_indent_1 = tslib_1.__importDefault(require("detect-indent"));
const logger_1 = require("../../../../../../logger");
const npm_1 = require("../../../../../versioning/npm");
const dependency_1 = require("../../dependency");
const parent_version_1 = require("../common/parent-version");
const dep_constraints_1 = require("./dep-constraints");
const get_locked_1 = require("./get-locked");
async function updateLockedDependency(config, isParentUpdate = false) {
    const { depName, currentVersion, newVersion, packageFile, packageFileContent, lockFile, lockFileContent, allowParentUpdates = true, allowHigherOrRemoved = false, } = config;
    logger_1.logger.debug(`npm.updateLockedDependency: ${depName}@${currentVersion} -> ${newVersion} [${lockFile}]`);
    try {
        let packageJson;
        let packageLockJson;
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        const detectedIndent = (0, detect_indent_1.default)(lockFileContent).indent || '  ';
        let newPackageJsonContent;
        try {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            packageJson = JSON.parse(packageFileContent);
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            packageLockJson = JSON.parse(lockFileContent);
        }
        catch (err) {
            logger_1.logger.warn({ err }, 'Failed to parse files');
            return { status: 'update-failed' };
        }
        const { lockfileVersion } = packageLockJson;
        const lockedDeps = (0, get_locked_1.getLockedDependencies)(packageLockJson, depName, 
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        currentVersion);
        if (lockedDeps.some((dep) => dep.bundled)) {
            logger_1.logger.info(`Package ${depName}@${currentVersion} is bundled and cannot be updated`);
            return { status: 'update-failed' };
        }
        if (!lockedDeps.length) {
            const newLockedDeps = (0, get_locked_1.getLockedDependencies)(packageLockJson, depName, newVersion);
            let status;
            if (newLockedDeps.length) {
                logger_1.logger.debug(`${depName}@${currentVersion} not found in ${lockFile} but ${depName}@${newVersion} was - looks like it's already updated`);
                status = 'already-updated';
            }
            else {
                if (lockfileVersion !== 1) {
                    logger_1.logger.debug(`Found lockfileVersion ${packageLockJson.lockfileVersion}`);
                    status = 'update-failed';
                }
                else if (allowHigherOrRemoved) {
                    // it's acceptable if the package is no longer present
                    const anyVersionLocked = (0, get_locked_1.getLockedDependencies)(packageLockJson, depName, null);
                    if (anyVersionLocked.length) {
                        if (anyVersionLocked.every((dep) => npm_1.api.isGreaterThan(dep.version, newVersion))) {
                            logger_1.logger.debug(`${depName} found in ${lockFile} with higher version - looks like it's already updated`);
                            status = 'already-updated';
                        }
                        else {
                            logger_1.logger.debug({ anyVersionLocked }, `Found alternative versions of qs`);
                            status = 'update-failed';
                        }
                    }
                    else {
                        logger_1.logger.debug(`${depName} not found in ${lockFile} - looks like it's already removed`);
                        status = 'already-updated';
                    }
                }
                else {
                    logger_1.logger.debug(`${depName}@${currentVersion} not found in ${lockFile} - cannot update`);
                    status = 'update-failed';
                }
            }
            // Don't return {} if we're a parent update or else the whole update will fail
            // istanbul ignore if: too hard to replicate
            if (isParentUpdate) {
                const files = {};
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                files[packageFile] = packageFileContent;
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                files[lockFile] = lockFileContent;
                return { status, files: files };
            }
            return { status };
        }
        logger_1.logger.debug(`Found matching dependencies with length ${lockedDeps.length}`);
        const constraints = (0, dep_constraints_1.findDepConstraints)(packageJson, packageLockJson, depName, 
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        currentVersion, newVersion);
        logger_1.logger.trace({ deps: lockedDeps, constraints }, 'Matching details');
        if (!constraints.length) {
            logger_1.logger.info({ depName, currentVersion, newVersion }, 'Could not find constraints for the locked dependency - cannot remediate');
            return { status: 'update-failed' };
        }
        const parentUpdates = [];
        for (const { parentDepName, parentVersion, constraint, depType, } of constraints) {
            if (npm_1.api.matches(newVersion, constraint)) {
                // Parent dependency is compatible with the new version we want
                logger_1.logger.debug(`${depName} can be updated to ${newVersion} in-range with matching constraint "${constraint}" in ${parentDepName ? `${parentDepName}@${parentVersion}` : packageFile}`);
            }
            else if (parentDepName && parentVersion) {
                if (!allowParentUpdates) {
                    logger_1.logger.debug(`Cannot update ${depName} to ${newVersion} without an update to ${parentDepName}`);
                    return { status: 'update-failed' };
                }
                // Parent dependency needs updating too
                const parentNewVersion = await (0, parent_version_1.findFirstParentVersion)(parentDepName, parentVersion, depName, newVersion);
                if (parentNewVersion) {
                    if (parentNewVersion === parentVersion) {
                        logger_1.logger.debug(`Update of ${depName} to ${newVersion} already achieved in parent ${parentDepName}@${parentNewVersion}`);
                    }
                    else {
                        // Update the parent dependency so that we can update this dependency
                        logger_1.logger.debug(`Update of ${depName} to ${newVersion} can be achieved due to parent ${parentDepName}`);
                        const parentUpdate = {
                            depName: parentDepName,
                            currentVersion: parentVersion,
                            newVersion: parentNewVersion,
                        };
                        parentUpdates.push(parentUpdate);
                    }
                }
                else {
                    // For some reason it's not possible to update the parent to a version compatible with our desired dep version
                    logger_1.logger.debug(`Update of ${depName} to ${newVersion} cannot be achieved due to parent ${parentDepName}`);
                    return { status: 'update-failed' };
                }
            }
            else if (depType) {
                // TODO: `newValue` can probably null
                // The constaint comes from the package.json file, so we need to update it
                const newValue = npm_1.api.getNewValue({
                    currentValue: constraint,
                    rangeStrategy: 'replace',
                    currentVersion,
                    newVersion,
                });
                newPackageJsonContent = (0, dependency_1.updateDependency)({
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                    fileContent: packageFileContent,
                    upgrade: { depName, depType, newValue },
                });
            }
        }
        for (const dependency of lockedDeps) {
            // Remove resolved and integrity fields for npm to fill in
            dependency.version = newVersion;
            delete dependency.resolved;
            delete dependency.integrity;
        }
        let newLockFileContent = JSON.stringify(packageLockJson, null, detectedIndent);
        // iterate through the parent updates first
        for (const parentUpdate of parentUpdates) {
            const parentUpdateConfig = {
                ...config,
                ...parentUpdate,
                lockFileContent: newLockFileContent,
                packageFileContent: newPackageJsonContent || packageFileContent,
            };
            const parentUpdateResult = await updateLockedDependency(parentUpdateConfig, true);
            // istanbul ignore if: hard to test due to recursion
            if (!parentUpdateResult.files) {
                logger_1.logger.debug(`Update of ${depName} to ${newVersion} impossible due to failed update of parent ${parentUpdate.depName} to ${parentUpdate.newVersion}`);
                return { status: 'update-failed' };
            }
            newPackageJsonContent =
                parentUpdateResult.files[packageFile] || newPackageJsonContent;
            newLockFileContent =
                parentUpdateResult.files[lockFile] || newLockFileContent;
        }
        const files = {};
        if (newLockFileContent) {
            files[lockFile] = newLockFileContent;
        }
        if (newPackageJsonContent) {
            files[packageFile] = newPackageJsonContent;
        }
        else if (lockfileVersion !== 1) {
            logger_1.logger.debug('Remediations which change package-lock.json only are not supported unless lockfileVersion=1');
            return { status: 'unsupported' };
        }
        return { status: 'updated', files };
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.error({ err }, 'updateLockedDependency() error');
        return { status: 'update-failed' };
    }
}
exports.updateLockedDependency = updateLockedDependency;
//# sourceMappingURL=index.js.map