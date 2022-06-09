"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateArtifacts = void 0;
const tslib_1 = require("tslib");
const shlex_1 = require("shlex");
const upath_1 = require("upath");
const error_messages_1 = require("../../../constants/error-messages");
const logger_1 = require("../../../logger");
const exec_1 = require("../../../util/exec");
const fs_1 = require("../../../util/fs");
const git_1 = require("../../../util/git");
const hostRules = tslib_1.__importStar(require("../../../util/host-rules"));
const regex_1 = require("../../../util/regex");
const nuget_1 = require("../../datasource/nuget");
const common_1 = require("../../datasource/nuget/common");
const package_tree_1 = require("./package-tree");
const util_1 = require("./util");
async function addSourceCmds(packageFileName, _config, nugetConfigFile) {
    const registries = (await (0, util_1.getConfiguredRegistries)(packageFileName)) || (0, util_1.getDefaultRegistries)();
    const result = [];
    for (const registry of registries) {
        const { username, password } = hostRules.find({
            hostType: nuget_1.NugetDatasource.id,
            url: registry.url,
        });
        const registryInfo = (0, common_1.parseRegistryUrl)(registry.url);
        let addSourceCmd = `dotnet nuget add source ${(0, shlex_1.quote)(registryInfo.feedUrl)} --configfile ${(0, shlex_1.quote)(nugetConfigFile)}`;
        if (registry.name) {
            // Add name for registry, if known.
            addSourceCmd += ` --name ${(0, shlex_1.quote)(registry.name)}`;
        }
        if (username && password) {
            // Add registry credentials from host rules, if configured.
            addSourceCmd += ` --username ${(0, shlex_1.quote)(username)} --password ${(0, shlex_1.quote)(password)} --store-password-in-clear-text`;
        }
        result.push(addSourceCmd);
    }
    return result;
}
async function runDotnetRestore(packageFileName, dependentPackageFileNames, config) {
    const execOptions = {
        docker: {
            image: 'dotnet',
        },
    };
    const nugetCacheDir = await (0, fs_1.ensureCacheDir)('nuget');
    const nugetConfigDir = (0, upath_1.join)(nugetCacheDir, `${(0, util_1.getRandomString)()}`);
    const nugetConfigFile = (0, upath_1.join)(nugetConfigDir, `nuget.config`);
    await (0, fs_1.outputFile)(nugetConfigFile, `<?xml version="1.0" encoding="utf-8"?>\n<configuration>\n</configuration>\n`);
    const cmds = [
        ...(await addSourceCmds(packageFileName, config, nugetConfigFile)),
        ...dependentPackageFileNames.map((fileName) => `dotnet restore ${(0, shlex_1.quote)(fileName)} --force-evaluate --configfile ${(0, shlex_1.quote)(nugetConfigFile)}`),
    ];
    await (0, exec_1.exec)(cmds, execOptions);
    await (0, fs_1.remove)(nugetConfigDir);
}
async function getLockFileContentMap(lockFileNames, local = false) {
    const lockFileContentMap = {};
    for (const lockFileName of lockFileNames) {
        lockFileContentMap[lockFileName] = local
            ? await (0, fs_1.readLocalFile)(lockFileName, 'utf8')
            : await (0, git_1.getFile)(lockFileName);
    }
    return lockFileContentMap;
}
async function updateArtifacts({ packageFileName, newPackageFileContent, config, updatedDeps, }) {
    logger_1.logger.debug(`nuget.updateArtifacts(${packageFileName})`);
    // https://github.com/NuGet/Home/wiki/Centrally-managing-NuGet-package-versions
    // https://github.com/microsoft/MSBuildSdks/tree/main/src/CentralPackageVersions
    const isCentralManament = packageFileName === package_tree_1.NUGET_CENTRAL_FILE ||
        packageFileName === package_tree_1.MSBUILD_CENTRAL_FILE ||
        packageFileName.endsWith(`/${package_tree_1.NUGET_CENTRAL_FILE}`) ||
        packageFileName.endsWith(`/${package_tree_1.MSBUILD_CENTRAL_FILE}`);
    if (!isCentralManament &&
        !(0, regex_1.regEx)(/(?:cs|vb|fs)proj$/i).test(packageFileName)) {
        // This could be implemented in the future if necessary.
        // It's not that easy though because the questions which
        // project file to restore how to determine which lock files
        // have been changed in such cases.
        logger_1.logger.debug({ packageFileName }, 'Not updating lock file for non project files');
        return null;
    }
    const packageFiles = [
        ...(await (0, package_tree_1.getDependentPackageFiles)(packageFileName, isCentralManament)),
    ];
    if (!isCentralManament) {
        packageFiles.push(packageFileName);
    }
    logger_1.logger.trace({ packageFiles }, `Found ${packageFiles.length} dependent package files`);
    const lockFileNames = packageFiles.map((f) => (0, fs_1.getSiblingFileName)(f, 'packages.lock.json'));
    const existingLockFileContentMap = await getLockFileContentMap(lockFileNames);
    const hasLockFileContent = Object.values(existingLockFileContentMap).some((val) => !!val);
    if (!hasLockFileContent) {
        logger_1.logger.debug({ packageFileName }, 'No lock file found for package or dependents');
        return null;
    }
    try {
        if (updatedDeps.length === 0 && config.isLockFileMaintenance !== true) {
            logger_1.logger.debug(`Not updating lock file because no deps changed and no lock file maintenance.`);
            return null;
        }
        await (0, fs_1.writeLocalFile)(packageFileName, newPackageFileContent);
        await runDotnetRestore(packageFileName, packageFiles, config);
        const newLockFileContentMap = await getLockFileContentMap(lockFileNames, true);
        const retArray = [];
        for (const lockFileName of lockFileNames) {
            if (existingLockFileContentMap[lockFileName] ===
                newLockFileContentMap[lockFileName]) {
                logger_1.logger.trace(`Lock file ${lockFileName} is unchanged`);
            }
            else if (newLockFileContentMap[lockFileName]) {
                retArray.push({
                    file: {
                        type: 'addition',
                        path: lockFileName,
                        contents: newLockFileContentMap[lockFileName],
                    },
                });
            }
            // TODO: else should we return an artifact error if new content is missing?
        }
        return retArray.length > 0 ? retArray : null;
    }
    catch (err) {
        // istanbul ignore if
        if (err.message === error_messages_1.TEMPORARY_ERROR) {
            throw err;
        }
        logger_1.logger.debug({ err }, 'Failed to generate lock file');
        return [
            {
                artifactError: {
                    lockFile: lockFileNames.join(', '),
                    stderr: err.message,
                },
            },
        ];
    }
}
exports.updateArtifacts = updateArtifacts;
//# sourceMappingURL=artifacts.js.map