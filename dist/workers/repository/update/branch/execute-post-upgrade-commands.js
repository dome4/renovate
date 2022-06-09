"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postUpgradeCommandsExecutor = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const minimatch_1 = tslib_1.__importDefault(require("minimatch"));
const global_1 = require("../../../../config/global");
const logger_1 = require("../../../../logger");
const exec_1 = require("../../../../util/exec");
const fs_1 = require("../../../../util/fs");
const git_1 = require("../../../../util/git");
const regex_1 = require("../../../../util/regex");
const sanitize_1 = require("../../../../util/sanitize");
const template_1 = require("../../../../util/template");
async function postUpgradeCommandsExecutor(filteredUpgradeCommands, config) {
    let updatedArtifacts = [...(config.updatedArtifacts || [])];
    const artifactErrors = [...(config.artifactErrors || [])];
    const { allowedPostUpgradeCommands, allowPostUpgradeCommandTemplating } = global_1.GlobalConfig.get();
    for (const upgrade of filteredUpgradeCommands) {
        (0, logger_1.addMeta)({ dep: upgrade.depName });
        logger_1.logger.trace({
            tasks: upgrade.postUpgradeTasks,
            allowedCommands: allowedPostUpgradeCommands,
        }, `Checking for post-upgrade tasks`);
        const commands = upgrade.postUpgradeTasks?.commands || [];
        const fileFilters = upgrade.postUpgradeTasks?.fileFilters || [];
        if (is_1.default.nonEmptyArray(commands)) {
            // Persist updated files in file system so any executed commands can see them
            for (const file of config.updatedPackageFiles.concat(updatedArtifacts)) {
                const canWriteFile = await (0, fs_1.localPathIsFile)(file.path);
                if (file.type === 'addition' && canWriteFile) {
                    let contents;
                    if (typeof file.contents === 'string') {
                        contents = Buffer.from(file.contents);
                    }
                    else {
                        contents = file.contents;
                    }
                    await (0, fs_1.writeLocalFile)(file.path, contents);
                }
            }
            for (const cmd of commands) {
                if (allowedPostUpgradeCommands.some((pattern) => (0, regex_1.regEx)(pattern).test(cmd))) {
                    try {
                        const compiledCmd = allowPostUpgradeCommandTemplating
                            ? (0, template_1.compile)(cmd, upgrade)
                            : cmd;
                        logger_1.logger.debug({ cmd: compiledCmd }, 'Executing post-upgrade task');
                        const execResult = await (0, exec_1.exec)(compiledCmd, {
                            cwd: global_1.GlobalConfig.get('localDir'),
                        });
                        logger_1.logger.debug({ cmd: compiledCmd, ...execResult }, 'Executed post-upgrade task');
                    }
                    catch (error) {
                        artifactErrors.push({
                            lockFile: upgrade.packageFile,
                            stderr: (0, sanitize_1.sanitize)(error.message),
                        });
                    }
                }
                else {
                    logger_1.logger.warn({
                        cmd,
                        allowedPostUpgradeCommands,
                    }, 'Post-upgrade task did not match any on allowedPostUpgradeCommands list');
                    artifactErrors.push({
                        lockFile: upgrade.packageFile,
                        stderr: (0, sanitize_1.sanitize)(`Post-upgrade command '${cmd}' has not been added to the allowed list in allowedPostUpgradeCommands`),
                    });
                }
            }
            const status = await (0, git_1.getRepoStatus)();
            for (const relativePath of status.modified.concat(status.not_added)) {
                for (const pattern of fileFilters) {
                    if ((0, minimatch_1.default)(relativePath, pattern)) {
                        logger_1.logger.debug({ file: relativePath, pattern }, 'Post-upgrade file saved');
                        const existingContent = await (0, fs_1.readLocalFile)(relativePath);
                        const existingUpdatedArtifacts = updatedArtifacts.find((ua) => ua.path === relativePath);
                        if (existingUpdatedArtifacts?.type === 'addition') {
                            existingUpdatedArtifacts.contents = existingContent;
                        }
                        else {
                            updatedArtifacts.push({
                                type: 'addition',
                                path: relativePath,
                                contents: existingContent,
                            });
                        }
                        // If the file is deleted by a previous post-update command, remove the deletion from updatedArtifacts
                        updatedArtifacts = updatedArtifacts.filter((ua) => !(ua.type === 'deletion' && ua.path === relativePath));
                    }
                }
            }
            for (const relativePath of status.deleted || []) {
                for (const pattern of fileFilters) {
                    if ((0, minimatch_1.default)(relativePath, pattern)) {
                        logger_1.logger.debug({ file: relativePath, pattern }, 'Post-upgrade file removed');
                        updatedArtifacts.push({
                            type: 'deletion',
                            path: relativePath,
                        });
                        // If the file is created or modified by a previous post-update command, remove the modification from updatedArtifacts
                        updatedArtifacts = updatedArtifacts.filter((ua) => !(ua.type === 'addition' && ua.path === relativePath));
                    }
                }
            }
        }
    }
    return { updatedArtifacts, artifactErrors };
}
exports.postUpgradeCommandsExecutor = postUpgradeCommandsExecutor;
async function executePostUpgradeCommands(config) {
    const { allowedPostUpgradeCommands } = global_1.GlobalConfig.get();
    const hasChangedFiles = config.updatedPackageFiles?.length > 0 ||
        config.updatedArtifacts?.length > 0;
    if (
    /* Only run post-upgrade tasks if there are changes to package files... */
    !hasChangedFiles ||
        is_1.default.emptyArray(allowedPostUpgradeCommands)) {
        return null;
    }
    const branchUpgradeCommands = [
        {
            manager: config.manager,
            depName: config.upgrades.map(({ depName }) => depName).join(' '),
            branchName: config.branchName,
            postUpgradeTasks: config.postUpgradeTasks.executionMode === 'branch'
                ? config.postUpgradeTasks
                : undefined,
            fileFilters: config.fileFilters,
        },
    ];
    const updateUpgradeCommands = config.upgrades.filter(({ postUpgradeTasks }) => !postUpgradeTasks ||
        !postUpgradeTasks.executionMode ||
        postUpgradeTasks.executionMode === 'update');
    const { updatedArtifacts, artifactErrors } = await postUpgradeCommandsExecutor(updateUpgradeCommands, config);
    return postUpgradeCommandsExecutor(branchUpgradeCommands, {
        ...config,
        updatedArtifacts,
        artifactErrors,
    });
}
exports.default = executePostUpgradeCommands;
//# sourceMappingURL=execute-post-upgrade-commands.js.map