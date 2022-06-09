"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUpdatedPackageFiles = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const error_messages_1 = require("../../../../constants/error-messages");
const logger_1 = require("../../../../logger");
const manager_1 = require("../../../../modules/manager");
const git_1 = require("../../../../util/git");
const auto_replace_1 = require("./auto-replace");
async function getUpdatedPackageFiles(config) {
    logger_1.logger.trace({ config });
    const { reuseExistingBranch } = config;
    logger_1.logger.debug(`manager.getUpdatedPackageFiles() reuseExistinbranch=${reuseExistingBranch}`);
    let updatedFileContents = {};
    const nonUpdatedFileContents = {};
    const packageFileManagers = {};
    const packageFileUpdatedDeps = {};
    const lockFileMaintenanceFiles = [];
    for (const upgrade of config.upgrades) {
        const { manager, packageFile, depName, newVersion } = upgrade;
        const updateLockedDependency = (0, manager_1.get)(manager, 'updateLockedDependency');
        packageFileManagers[packageFile] = manager;
        packageFileUpdatedDeps[packageFile] =
            packageFileUpdatedDeps[packageFile] || [];
        packageFileUpdatedDeps[packageFile].push({ ...upgrade });
        let packageFileContent = updatedFileContents[packageFile];
        if (!packageFileContent) {
            packageFileContent = await (0, git_1.getFile)(packageFile, reuseExistingBranch ? config.branchName : config.baseBranch);
        }
        let lockFileContent;
        const lockFile = upgrade.lockFile || upgrade.lockFiles?.[0] || '';
        if (lockFile) {
            lockFileContent = updatedFileContents[lockFile];
            if (!lockFileContent) {
                lockFileContent = await (0, git_1.getFile)(lockFile, reuseExistingBranch ? config.branchName : config.baseBranch);
            }
        }
        // istanbul ignore if
        if (reuseExistingBranch &&
            (!packageFileContent || (lockFile && !lockFileContent))) {
            logger_1.logger.debug({ packageFile, depName }, 'Rebasing branch after file not found');
            return getUpdatedPackageFiles({
                ...config,
                reuseExistingBranch: false,
            });
        }
        if (upgrade.updateType === 'lockFileMaintenance') {
            lockFileMaintenanceFiles.push(packageFile);
        }
        else if (upgrade.isRemediation) {
            const { status, files } = await updateLockedDependency({
                ...upgrade,
                depName,
                newVersion,
                packageFile,
                packageFileContent,
                lockFile,
                lockFileContent,
                allowParentUpdates: true,
                allowHigherOrRemoved: true,
            });
            if (reuseExistingBranch && status !== 'already-updated') {
                logger_1.logger.debug({ lockFile, depName, status }, 'Need to retry branch as it is not already up-to-date');
                return getUpdatedPackageFiles({
                    ...config,
                    reuseExistingBranch: false,
                });
            }
            if (files) {
                updatedFileContents = { ...updatedFileContents, ...files };
            }
            if (status === 'update-failed' || status === 'unsupported') {
                upgrade.remediationNotPossible = true;
            }
        }
        else if (upgrade.isLockfileUpdate) {
            if (updateLockedDependency) {
                const { status, files } = await updateLockedDependency({
                    ...upgrade,
                    depName,
                    newVersion,
                    packageFile,
                    packageFileContent,
                    lockFile,
                    lockFileContent,
                    allowParentUpdates: false,
                });
                if (status === 'unsupported') {
                    // incompatible lock file
                    nonUpdatedFileContents[packageFile] = packageFileContent;
                }
                else if (status === 'already-updated') {
                    logger_1.logger.debug(`Upgrade of ${depName} to ${newVersion} is already done in existing branch`);
                }
                else {
                    // something changed
                    if (reuseExistingBranch) {
                        logger_1.logger.debug({ lockFile, depName, status }, 'Need to retry branch as upgrade requirements are not mets');
                        return getUpdatedPackageFiles({
                            ...config,
                            reuseExistingBranch: false,
                        });
                    }
                    if (files) {
                        updatedFileContents = { ...updatedFileContents, ...files };
                    }
                }
            }
            else {
                logger_1.logger.debug({ manager }, 'isLockFileUpdate without updateLockedDependency');
                nonUpdatedFileContents[packageFile] = packageFileContent;
            }
        }
        else {
            const bumpPackageVersion = (0, manager_1.get)(manager, 'bumpPackageVersion');
            const updateDependency = (0, manager_1.get)(manager, 'updateDependency');
            if (!updateDependency) {
                let res = await (0, auto_replace_1.doAutoReplace)(upgrade, packageFileContent, reuseExistingBranch);
                if (res) {
                    if (bumpPackageVersion && upgrade.bumpVersion) {
                        const { bumpedContent } = await bumpPackageVersion(res, upgrade.packageFileVersion, upgrade.bumpVersion);
                        res = bumpedContent;
                    }
                    if (res === packageFileContent) {
                        logger_1.logger.debug({ packageFile, depName }, 'No content changed');
                    }
                    else {
                        logger_1.logger.debug({ packageFile, depName }, 'Contents updated');
                        updatedFileContents[packageFile] = res;
                    }
                    continue;
                }
                else if (reuseExistingBranch) {
                    return getUpdatedPackageFiles({
                        ...config,
                        reuseExistingBranch: false,
                    });
                }
                logger_1.logger.error({ packageFile, depName }, 'Could not autoReplace');
                throw new Error(error_messages_1.WORKER_FILE_UPDATE_FAILED);
            }
            let newContent = await updateDependency({
                fileContent: packageFileContent,
                upgrade,
            });
            if (bumpPackageVersion && upgrade.bumpVersion) {
                const { bumpedContent } = await bumpPackageVersion(newContent, upgrade.packageFileVersion, upgrade.bumpVersion);
                newContent = bumpedContent;
            }
            if (!newContent) {
                if (reuseExistingBranch) {
                    logger_1.logger.debug({ packageFile, depName }, 'Rebasing branch after error updating content');
                    return getUpdatedPackageFiles({
                        ...config,
                        reuseExistingBranch: false,
                    });
                }
                logger_1.logger.debug({ existingContent: packageFileContent, config: upgrade }, 'Error updating file');
                throw new Error(error_messages_1.WORKER_FILE_UPDATE_FAILED);
            }
            if (newContent !== packageFileContent) {
                if (reuseExistingBranch) {
                    // This ensure it's always 1 commit from the bot
                    logger_1.logger.debug({ packageFile, depName }, 'Need to update package file so will rebase first');
                    return getUpdatedPackageFiles({
                        ...config,
                        reuseExistingBranch: false,
                    });
                }
                logger_1.logger.debug(`Updating ${depName} in ${packageFile || lockFile}`);
                updatedFileContents[packageFile] = newContent;
            }
            if (newContent === packageFileContent) {
                if (upgrade.manager === 'git-submodules') {
                    updatedFileContents[packageFile] = newContent;
                }
            }
        }
    }
    const updatedPackageFiles = Object.keys(updatedFileContents).map((name) => ({
        type: 'addition',
        path: name,
        contents: updatedFileContents[name],
    }));
    const updatedArtifacts = [];
    const artifactErrors = [];
    for (const packageFile of updatedPackageFiles) {
        const manager = packageFileManagers[packageFile.path];
        const updatedDeps = packageFileUpdatedDeps[packageFile.path];
        const updateArtifacts = (0, manager_1.get)(manager, 'updateArtifacts');
        if (updateArtifacts) {
            const results = await updateArtifacts({
                packageFileName: packageFile.path,
                updatedDeps,
                newPackageFileContent: packageFile.contents.toString(),
                config,
            });
            if (is_1.default.nonEmptyArray(results)) {
                for (const res of results) {
                    const { file, artifactError } = res;
                    if (file) {
                        updatedArtifacts.push(file);
                    }
                    else if (artifactError) {
                        artifactErrors.push(artifactError);
                    }
                }
            }
        }
    }
    const nonUpdatedPackageFiles = Object.keys(nonUpdatedFileContents).map((name) => ({
        type: 'addition',
        path: name,
        contents: nonUpdatedFileContents[name],
    }));
    for (const packageFile of nonUpdatedPackageFiles) {
        const manager = packageFileManagers[packageFile.path];
        const updatedDeps = packageFileUpdatedDeps[packageFile.path];
        const updateArtifacts = (0, manager_1.get)(manager, 'updateArtifacts');
        if (updateArtifacts) {
            const results = await updateArtifacts({
                packageFileName: packageFile.path,
                updatedDeps,
                newPackageFileContent: packageFile.contents.toString(),
                config,
            });
            if (is_1.default.nonEmptyArray(results)) {
                updatedPackageFiles.push(packageFile);
                for (const res of results) {
                    const { file, artifactError } = res;
                    // istanbul ignore else
                    if (file) {
                        updatedArtifacts.push(file);
                    }
                    else if (artifactError) {
                        artifactErrors.push(artifactError);
                    }
                }
            }
        }
    }
    if (!reuseExistingBranch) {
        // Only perform lock file maintenance if it's a fresh commit
        for (const packageFile of lockFileMaintenanceFiles) {
            const manager = packageFileManagers[packageFile];
            const updateArtifacts = (0, manager_1.get)(manager, 'updateArtifacts');
            if (updateArtifacts) {
                const packageFileContents = updatedFileContents[packageFile] ||
                    (await (0, git_1.getFile)(packageFile, reuseExistingBranch ? config.branchName : config.baseBranch));
                const results = await updateArtifacts({
                    packageFileName: packageFile,
                    updatedDeps: [],
                    newPackageFileContent: packageFileContents,
                    config,
                });
                if (is_1.default.nonEmptyArray(results)) {
                    for (const res of results) {
                        const { file, artifactError } = res;
                        if (file) {
                            updatedArtifacts.push(file);
                        }
                        else if (artifactError) {
                            artifactErrors.push(artifactError);
                        }
                    }
                }
            }
        }
    }
    return {
        reuseExistingBranch,
        updatedPackageFiles,
        updatedArtifacts,
        artifactErrors,
    };
}
exports.getUpdatedPackageFiles = getUpdatedPackageFiles;
//# sourceMappingURL=get-updated.js.map