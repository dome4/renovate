"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdditionalFiles = exports.updateYarnBinary = exports.writeUpdatedPackageFiles = exports.writeExistingFiles = exports.determineLockFileDirs = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const deepmerge_1 = tslib_1.__importDefault(require("deepmerge"));
const detect_indent_1 = tslib_1.__importDefault(require("detect-indent"));
const js_yaml_1 = require("js-yaml");
const upath_1 = tslib_1.__importDefault(require("upath"));
const error_messages_1 = require("../../../../constants/error-messages");
const logger_1 = require("../../../../logger");
const external_host_error_1 = require("../../../../types/errors/external-host-error");
const env_1 = require("../../../../util/exec/env");
const fs_1 = require("../../../../util/fs");
const git_1 = require("../../../../util/git");
const hostRules = tslib_1.__importStar(require("../../../../util/host-rules"));
const regex_1 = require("../../../../util/regex");
const url_1 = require("../../../../util/url");
const npm_1 = require("../../../datasource/npm");
const yarn_1 = require("../extract/yarn");
const utils_1 = require("../utils");
const lerna = tslib_1.__importStar(require("./lerna"));
const npm = tslib_1.__importStar(require("./npm"));
const pnpm = tslib_1.__importStar(require("./pnpm"));
const rules_1 = require("./rules");
const yarn = tslib_1.__importStar(require("./yarn"));
// Strips empty values, deduplicates, and returns the directories from filenames
const getDirs = (arr) => Array.from(new Set(arr.filter(is_1.default.string)));
function determineLockFileDirs(config, packageFiles) {
    const npmLockDirs = [];
    const yarnLockDirs = [];
    const pnpmShrinkwrapDirs = [];
    const lernaJsonFiles = [];
    for (const upgrade of config.upgrades) {
        if (upgrade.updateType === 'lockFileMaintenance' || upgrade.isRemediation) {
            // Return every directory that contains a lockfile
            if (upgrade.managerData?.lernaJsonFile && upgrade.npmLock) {
                lernaJsonFiles.push(upgrade.managerData.lernaJsonFile);
            }
            else {
                yarnLockDirs.push(upgrade.yarnLock);
                npmLockDirs.push(upgrade.npmLock);
                pnpmShrinkwrapDirs.push(upgrade.pnpmShrinkwrap);
            }
            continue;
        }
        if (upgrade.isLockfileUpdate) {
            yarnLockDirs.push(upgrade.yarnLock);
            npmLockDirs.push(upgrade.npmLock);
        }
    }
    if (config.upgrades.every((upgrade) => upgrade.updateType === 'lockFileMaintenance' || upgrade.isLockfileUpdate)) {
        return {
            yarnLockDirs: getDirs(yarnLockDirs),
            npmLockDirs: getDirs(npmLockDirs),
            pnpmShrinkwrapDirs: getDirs(pnpmShrinkwrapDirs),
            lernaJsonFiles: getDirs(lernaJsonFiles),
        };
    }
    function getPackageFile(fileName) {
        logger_1.logger.trace('Looking for packageFile: ' + fileName);
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        for (const packageFile of packageFiles.npm) {
            if (packageFile.packageFile === fileName) {
                logger_1.logger.trace({ packageFile }, 'Found packageFile');
                return packageFile;
            }
            logger_1.logger.trace('No match');
        }
        return {};
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    for (const p of config.updatedPackageFiles) {
        logger_1.logger.trace(`Checking ${String(p.path)} for lock files`);
        const packageFile = getPackageFile(p.path);
        // lerna first
        if (packageFile.managerData?.lernaJsonFile && packageFile.npmLock) {
            logger_1.logger.debug(`${packageFile.packageFile} has lerna lock file`);
            lernaJsonFiles.push(packageFile.managerData.lernaJsonFile);
        }
        else if (packageFile.managerData?.lernaJsonFile &&
            packageFile.yarnLock &&
            !packageFile.hasYarnWorkspaces) {
            lernaJsonFiles.push(packageFile.managerData.lernaJsonFile);
        }
        else {
            // push full lock file names and convert them later
            yarnLockDirs.push(packageFile.yarnLock);
            npmLockDirs.push(packageFile.npmLock);
            pnpmShrinkwrapDirs.push(packageFile.pnpmShrinkwrap);
        }
    }
    return {
        yarnLockDirs: getDirs(yarnLockDirs),
        npmLockDirs: getDirs(npmLockDirs),
        pnpmShrinkwrapDirs: getDirs(pnpmShrinkwrapDirs),
        lernaJsonFiles: getDirs(lernaJsonFiles),
    };
}
exports.determineLockFileDirs = determineLockFileDirs;
async function writeExistingFiles(config, packageFiles) {
    if (!packageFiles.npm) {
        return;
    }
    const npmFiles = packageFiles.npm;
    logger_1.logger.debug({ packageFiles: npmFiles.map((n) => n.packageFile) }, 'Writing package.json files');
    for (const packageFile of npmFiles) {
        const basedir = 
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        upath_1.default.dirname(packageFile.packageFile);
        const npmrc = packageFile.npmrc || config.npmrc;
        const npmrcFilename = upath_1.default.join(basedir, '.npmrc');
        if (is_1.default.string(npmrc)) {
            try {
                await (0, fs_1.writeLocalFile)(npmrcFilename, `${npmrc}\n`);
            }
            catch (err) /* istanbul ignore next */ {
                logger_1.logger.warn({ npmrcFilename, err }, 'Error writing .npmrc');
            }
        }
        const { npmLock } = packageFile;
        if (npmLock) {
            const npmLockPath = npmLock;
            if (process.env.RENOVATE_REUSE_PACKAGE_LOCK === 'false' ||
                config.reuseLockFiles === false) {
                logger_1.logger.debug(`Ensuring ${npmLock} is removed`);
                await (0, fs_1.deleteLocalFile)(npmLockPath);
            }
            else {
                logger_1.logger.debug(`Writing ${npmLock}`);
                let existingNpmLock;
                try {
                    existingNpmLock = (await (0, git_1.getFile)(npmLock)) ?? '';
                }
                catch (err) /* istanbul ignore next */ {
                    logger_1.logger.warn({ err }, 'Error reading npm lock file');
                    existingNpmLock = '';
                }
                const { detectedIndent, lockFileParsed: npmLockParsed } = (0, utils_1.parseLockFile)(existingNpmLock);
                if (npmLockParsed) {
                    const packageNames = 'packages' in npmLockParsed
                        ? Object.keys(npmLockParsed.packages)
                        : [];
                    const widens = [];
                    let lockFileChanged = false;
                    for (const upgrade of config.upgrades) {
                        if (upgrade.rangeStrategy === 'widen' &&
                            upgrade.npmLock === npmLock) {
                            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                            widens.push(upgrade.depName);
                        }
                        const { depName } = upgrade;
                        for (const packageName of packageNames) {
                            if ('packages' in npmLockParsed &&
                                (packageName === `node_modules/${depName}` ||
                                    packageName.startsWith(`node_modules/${depName}/`))) {
                                logger_1.logger.trace({ packageName }, 'Massaging out package name');
                                lockFileChanged = true;
                                delete npmLockParsed.packages[packageName];
                            }
                        }
                    }
                    if (widens.length) {
                        logger_1.logger.debug(`Removing ${String(widens)} from ${npmLock} to force an update`);
                        lockFileChanged = true;
                        try {
                            if ('dependencies' in npmLockParsed &&
                                npmLockParsed.dependencies) {
                                widens.forEach((depName) => {
                                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                                    delete npmLockParsed.dependencies[depName];
                                });
                            }
                        }
                        catch (err) /* istanbul ignore next */ {
                            logger_1.logger.warn({ npmLock }, 'Error massaging package-lock.json for widen');
                        }
                    }
                    if (lockFileChanged) {
                        logger_1.logger.debug('Massaging npm lock file before writing to disk');
                        existingNpmLock = (0, utils_1.composeLockFile)(npmLockParsed, detectedIndent);
                    }
                    await (0, fs_1.writeLocalFile)(npmLockPath, existingNpmLock);
                }
            }
        }
        const { yarnLock } = packageFile;
        if (yarnLock && config.reuseLockFiles === false) {
            await (0, fs_1.deleteLocalFile)(yarnLock);
        }
        // istanbul ignore next
        if (packageFile.pnpmShrinkwrap && config.reuseLockFiles === false) {
            await (0, fs_1.deleteLocalFile)(packageFile.pnpmShrinkwrap);
        }
    }
}
exports.writeExistingFiles = writeExistingFiles;
async function writeUpdatedPackageFiles(config) {
    logger_1.logger.trace({ config }, 'writeUpdatedPackageFiles');
    logger_1.logger.debug('Writing any updated package files');
    if (!config.updatedPackageFiles) {
        logger_1.logger.debug('No files found');
        return;
    }
    const supportedLockFiles = ['package-lock.json', 'yarn.lock'];
    for (const packageFile of config.updatedPackageFiles) {
        if (packageFile.type !== 'addition') {
            continue;
        }
        if (supportedLockFiles.some((fileName) => packageFile.path.endsWith(fileName))) {
            logger_1.logger.debug(`Writing lock file: ${packageFile.path}`);
            await (0, fs_1.writeLocalFile)(packageFile.path, packageFile.contents);
            continue;
        }
        if (!packageFile.path.endsWith('package.json')) {
            continue;
        }
        logger_1.logger.debug(`Writing ${packageFile.path}`);
        const detectedIndent = (0, detect_indent_1.default)(packageFile.contents.toString()).indent || '  ';
        const massagedFile = JSON.parse(packageFile.contents.toString());
        try {
            const { token } = hostRules.find({
                hostType: 'github',
                url: 'https://api.github.com/',
            });
            for (const upgrade of config.upgrades) {
                // istanbul ignore if: test me
                if (upgrade.gitRef && upgrade.packageFile === packageFile.path) {
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                    massagedFile[upgrade.depType][upgrade.depName] =
                        massagedFile[upgrade.depType
                        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                        ][upgrade.depName].replace('git+https://github.com', `git+https://${token}@github.com`);
                }
            }
        }
        catch (err) /* istanbul ignore next */ {
            logger_1.logger.warn({ err }, 'Error adding token to package files');
        }
        await (0, fs_1.writeLocalFile)(packageFile.path, JSON.stringify(massagedFile, null, detectedIndent));
    }
}
exports.writeUpdatedPackageFiles = writeUpdatedPackageFiles;
async function getNpmrcContent(dir) {
    const npmrcFilePath = upath_1.default.join(dir, '.npmrc');
    let originalNpmrcContent = null;
    try {
        originalNpmrcContent = await (0, fs_1.readLocalFile)(npmrcFilePath, 'utf8');
        logger_1.logger.debug('npmrc file found in repository');
    }
    catch /* istanbul ignore next */ {
        logger_1.logger.debug('No npmrc file found in repository');
        originalNpmrcContent = null;
    }
    return originalNpmrcContent;
}
async function updateNpmrcContent(dir, originalContent, additionalLines) {
    const npmrcFilePath = upath_1.default.join(dir, '.npmrc');
    const newNpmrc = originalContent
        ? [originalContent, ...additionalLines]
        : additionalLines;
    try {
        const newContent = newNpmrc.join('\n');
        if (newContent !== originalContent) {
            logger_1.logger.debug(`Writing updated .npmrc file to ${npmrcFilePath}`);
            await (0, fs_1.writeLocalFile)(npmrcFilePath, `${newContent}\n`);
        }
    }
    catch /* istanbul ignore next */ {
        logger_1.logger.warn('Unable to write custom npmrc file');
    }
}
async function resetNpmrcContent(dir, originalContent) {
    const npmrcFilePath = upath_1.default.join(dir, '.npmrc');
    if (originalContent) {
        try {
            await (0, fs_1.writeLocalFile)(npmrcFilePath, originalContent);
        }
        catch /* istanbul ignore next */ {
            logger_1.logger.warn('Unable to reset npmrc to original contents');
        }
    }
    else {
        try {
            await (0, fs_1.deleteLocalFile)(npmrcFilePath);
        }
        catch /* istanbul ignore next */ {
            logger_1.logger.warn('Unable to delete custom npmrc');
        }
    }
}
// istanbul ignore next
async function updateYarnOffline(lockFileDir, updatedArtifacts) {
    try {
        const resolvedPaths = [];
        const yarnrcYml = await (0, git_1.getFile)(upath_1.default.join(lockFileDir, '.yarnrc.yml'));
        const yarnrc = await (0, git_1.getFile)(upath_1.default.join(lockFileDir, '.yarnrc'));
        // As .yarnrc.yml overrides .yarnrc in Yarn 1 (https://git.io/JUcco)
        // both files may exist, so check for .yarnrc.yml first
        if (yarnrcYml) {
            // Yarn 2 (offline cache and zero-installs)
            const paths = (0, yarn_1.getZeroInstallPaths)(yarnrcYml);
            resolvedPaths.push(...paths.map((p) => upath_1.default.join(lockFileDir, p)));
        }
        else if (yarnrc) {
            // Yarn 1 (offline mirror)
            const mirrorLine = yarnrc
                .split(regex_1.newlineRegex)
                .find((line) => line.startsWith('yarn-offline-mirror '));
            if (mirrorLine) {
                const mirrorPath = (0, url_1.ensureTrailingSlash)(mirrorLine.split(' ')[1].replace((0, regex_1.regEx)(/"/g), ''));
                resolvedPaths.push(upath_1.default.join(lockFileDir, mirrorPath));
            }
        }
        logger_1.logger.debug({ resolvedPaths }, 'updateYarnOffline resolvedPaths');
        if (resolvedPaths.length) {
            const status = await (0, git_1.getRepoStatus)();
            for (const f of status.modified.concat(status.not_added)) {
                if (resolvedPaths.some((p) => f.startsWith(p))) {
                    updatedArtifacts.push({
                        type: 'addition',
                        path: f,
                        contents: await (0, fs_1.readLocalFile)(f),
                    });
                }
            }
            for (const f of status.deleted || []) {
                if (resolvedPaths.some((p) => f.startsWith(p))) {
                    updatedArtifacts.push({ type: 'deletion', path: f });
                }
            }
        }
    }
    catch (err) {
        logger_1.logger.error({ err }, 'Error updating yarn offline packages');
    }
}
// exported for testing
async function updateYarnBinary(lockFileDir, updatedArtifacts, existingYarnrcYmlContent) {
    let yarnrcYml = existingYarnrcYmlContent;
    try {
        const yarnrcYmlFilename = upath_1.default.join(lockFileDir, '.yarnrc.yml');
        yarnrcYml || (yarnrcYml = (await (0, git_1.getFile)(yarnrcYmlFilename)) ?? undefined);
        const newYarnrcYml = await (0, fs_1.readLocalFile)(yarnrcYmlFilename, 'utf8');
        if (!is_1.default.string(yarnrcYml) || !is_1.default.string(newYarnrcYml)) {
            return existingYarnrcYmlContent;
        }
        const oldYarnPath = (0, js_yaml_1.load)(yarnrcYml).yarnPath;
        const newYarnPath = (0, js_yaml_1.load)(newYarnrcYml).yarnPath;
        const oldYarnFullPath = upath_1.default.join(lockFileDir, oldYarnPath);
        const newYarnFullPath = upath_1.default.join(lockFileDir, newYarnPath);
        logger_1.logger.debug({ oldYarnPath, newYarnPath }, 'Found updated Yarn binary');
        yarnrcYml = yarnrcYml.replace(oldYarnPath, newYarnPath);
        updatedArtifacts.push({
            type: 'addition',
            path: yarnrcYmlFilename,
            contents: yarnrcYml,
        }, {
            type: 'deletion',
            path: oldYarnFullPath,
        }, {
            type: 'addition',
            path: newYarnFullPath,
            contents: await (0, fs_1.readLocalFile)(newYarnFullPath, 'utf8'),
            isExecutable: true,
        });
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.error({ err }, 'Error updating Yarn binary');
    }
    return existingYarnrcYmlContent && yarnrcYml;
}
exports.updateYarnBinary = updateYarnBinary;
async function getAdditionalFiles(config, packageFiles) {
    logger_1.logger.trace({ config }, 'getAdditionalFiles');
    const artifactErrors = [];
    const updatedArtifacts = [];
    if (!packageFiles.npm?.length) {
        return { artifactErrors, updatedArtifacts };
    }
    if (!config.updateLockFiles) {
        logger_1.logger.debug('Skipping lock file generation');
        return { artifactErrors, updatedArtifacts };
    }
    if (!config.updatedPackageFiles?.length &&
        config.transitiveRemediation &&
        config.upgrades?.every((upgrade) => upgrade.isRemediation || upgrade.isVulnerabilityAlert)) {
        logger_1.logger.debug('Skipping lock file generation for remediations');
        return { artifactErrors, updatedArtifacts };
    }
    if (config.reuseExistingBranch &&
        !config.updatedPackageFiles?.length &&
        config.upgrades?.every((upgrade) => upgrade.isLockfileUpdate)) {
        logger_1.logger.debug('Existing branch contains all necessary lock file updates');
        return { artifactErrors, updatedArtifacts };
    }
    logger_1.logger.debug('Getting updated lock files');
    if (config.updateType === 'lockFileMaintenance' &&
        config.reuseExistingBranch &&
        (0, git_1.branchExists)(config.branchName)) {
        logger_1.logger.debug('Skipping lockFileMaintenance update');
        return { artifactErrors, updatedArtifacts };
    }
    const dirs = determineLockFileDirs(config, packageFiles);
    logger_1.logger.trace({ dirs }, 'lock file dirs');
    await writeExistingFiles(config, packageFiles);
    await writeUpdatedPackageFiles(config);
    const { additionalNpmrcContent, additionalYarnRcYml } = (0, rules_1.processHostRules)();
    const env = {
        ...(0, env_1.getChildProcessEnv)(),
        NPM_CONFIG_CACHE: await (0, fs_1.ensureCacheDir)('npm'),
        YARN_CACHE_FOLDER: await (0, fs_1.ensureCacheDir)('yarn'),
        YARN_GLOBAL_FOLDER: await (0, fs_1.ensureCacheDir)('berry'),
        npm_config_store: await (0, fs_1.ensureCacheDir)('pnpm'),
        NODE_ENV: 'dev',
    };
    let token;
    try {
        ({ token } = hostRules.find({
            hostType: 'github',
            url: 'https://api.github.com/',
        }));
        token = token ? /* istanbul ignore next */ `${token}@` : token;
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.warn({ err }, 'Error getting token for packageFile');
    }
    const tokenRe = (0, regex_1.regEx)(`${token ?? ''}`, 'g', false);
    for (const npmLock of dirs.npmLockDirs) {
        const lockFileDir = upath_1.default.dirname(npmLock);
        const npmrcContent = await getNpmrcContent(lockFileDir);
        await updateNpmrcContent(lockFileDir, npmrcContent, additionalNpmrcContent);
        const fileName = upath_1.default.basename(npmLock);
        logger_1.logger.debug(`Generating ${fileName} for ${lockFileDir}`);
        const upgrades = config.upgrades.filter((upgrade) => upgrade.npmLock === npmLock);
        const res = await npm.generateLockFile(lockFileDir, env, fileName, config, upgrades);
        if (res.error) {
            // istanbul ignore if
            if (res.stderr?.includes('No matching version found for')) {
                for (const upgrade of config.upgrades) {
                    if (res.stderr.includes(`No matching version found for ${upgrade.depName}`)) {
                        logger_1.logger.debug({ dependency: upgrade.depName, type: 'npm' }, 'lock file failed for the dependency being updated - skipping branch creation');
                        const err = new Error('lock file failed for the dependency being updated - skipping branch creation');
                        throw new external_host_error_1.ExternalHostError(err, npm_1.NpmDatasource.id);
                    }
                }
            }
            artifactErrors.push({
                lockFile: npmLock,
                stderr: res.stderr,
            });
        }
        else {
            const existingContent = await (0, git_1.getFile)(npmLock, config.reuseExistingBranch ? config.branchName : config.baseBranch);
            if (res.lockFile === existingContent) {
                logger_1.logger.debug(`${npmLock} hasn't changed`);
            }
            else {
                logger_1.logger.debug(`${npmLock} needs updating`);
                updatedArtifacts.push({
                    type: 'addition',
                    path: npmLock,
                    // TODO: can this be undefined?
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                    contents: res.lockFile.replace(tokenRe, ''),
                });
            }
        }
        await resetNpmrcContent(lockFileDir, npmrcContent);
    }
    for (const yarnLock of dirs.yarnLockDirs) {
        const lockFileDir = upath_1.default.dirname(yarnLock);
        const npmrcContent = await getNpmrcContent(lockFileDir);
        await updateNpmrcContent(lockFileDir, npmrcContent, additionalNpmrcContent);
        let yarnRcYmlFilename;
        let existingYarnrcYmlContent;
        // istanbul ignore if: needs test
        if (additionalYarnRcYml) {
            yarnRcYmlFilename = (0, fs_1.getSiblingFileName)(yarnLock, '.yarnrc.yml');
            existingYarnrcYmlContent = await (0, fs_1.readLocalFile)(yarnRcYmlFilename, 'utf8');
            if (existingYarnrcYmlContent) {
                try {
                    const existingYarnrRcYml = (0, js_yaml_1.load)(existingYarnrcYmlContent);
                    const updatedYarnYrcYml = (0, deepmerge_1.default)(existingYarnrRcYml, additionalYarnRcYml);
                    await (0, fs_1.writeLocalFile)(yarnRcYmlFilename, (0, js_yaml_1.dump)(updatedYarnYrcYml));
                    logger_1.logger.debug('Added authentication to .yarnrc.yml');
                }
                catch (err) {
                    logger_1.logger.warn({ err }, 'Error appending .yarnrc.yml content');
                }
            }
        }
        logger_1.logger.debug(`Generating yarn.lock for ${lockFileDir}`);
        const lockFileName = upath_1.default.join(lockFileDir, 'yarn.lock');
        const upgrades = config.upgrades.filter((upgrade) => upgrade.yarnLock === yarnLock);
        const res = await yarn.generateLockFile(lockFileDir, env, config, upgrades);
        if (res.error) {
            // istanbul ignore if
            if (res.stderr?.includes(`Couldn't find any versions for`)) {
                for (const upgrade of config.upgrades) {
                    /* eslint-disable no-useless-escape */
                    if (res.stderr.includes(`Couldn't find any versions for \\\"${upgrade.depName}\\\"`)) {
                        logger_1.logger.debug({ dependency: upgrade.depName, type: 'yarn' }, 'lock file failed for the dependency being updated - skipping branch creation');
                        throw new external_host_error_1.ExternalHostError(new Error('lock file failed for the dependency being updated - skipping branch creation'), npm_1.NpmDatasource.id);
                    }
                    /* eslint-enable no-useless-escape */
                }
            }
            artifactErrors.push({
                lockFile: yarnLock,
                stderr: res.stderr || res.stdout,
            });
        }
        else {
            const existingContent = await (0, git_1.getFile)(lockFileName, config.reuseExistingBranch ? config.branchName : config.baseBranch);
            if (res.lockFile === existingContent) {
                logger_1.logger.debug("yarn.lock hasn't changed");
            }
            else {
                logger_1.logger.debug('yarn.lock needs updating');
                updatedArtifacts.push({
                    type: 'addition',
                    path: lockFileName,
                    //
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                    contents: res.lockFile,
                });
                await updateYarnOffline(lockFileDir, updatedArtifacts);
            }
            // istanbul ignore if: already tested seperately, needs additional test?
            if (upgrades.some(yarn.isYarnUpdate)) {
                existingYarnrcYmlContent = await updateYarnBinary(lockFileDir, updatedArtifacts, existingYarnrcYmlContent);
            }
        }
        await resetNpmrcContent(lockFileDir, npmrcContent);
        // istanbul ignore if: needs test
        if (existingYarnrcYmlContent) {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            await (0, fs_1.writeLocalFile)(yarnRcYmlFilename, existingYarnrcYmlContent);
        }
    }
    for (const pnpmShrinkwrap of dirs.pnpmShrinkwrapDirs) {
        const lockFileDir = upath_1.default.dirname(pnpmShrinkwrap);
        const npmrcContent = await getNpmrcContent(lockFileDir);
        await updateNpmrcContent(lockFileDir, npmrcContent, additionalNpmrcContent);
        logger_1.logger.debug(`Generating pnpm-lock.yaml for ${lockFileDir}`);
        const upgrades = config.upgrades.filter((upgrade) => upgrade.pnpmShrinkwrap === pnpmShrinkwrap);
        const res = await pnpm.generateLockFile(lockFileDir, env, config, upgrades);
        if (res.error) {
            // istanbul ignore if
            if (res.stdout?.includes(`No compatible version found:`)) {
                for (const upgrade of config.upgrades) {
                    if (res.stdout.includes(`No compatible version found: ${upgrade.depName}`)) {
                        logger_1.logger.debug({ dependency: upgrade.depName, type: 'pnpm' }, 'lock file failed for the dependency being updated - skipping branch creation');
                        throw new external_host_error_1.ExternalHostError(Error('lock file failed for the dependency being updated - skipping branch creation'), npm_1.NpmDatasource.id);
                    }
                }
            }
            artifactErrors.push({
                lockFile: pnpmShrinkwrap,
                stderr: res.stderr || res.stdout,
            });
        }
        else {
            const existingContent = await (0, git_1.getFile)(pnpmShrinkwrap, config.reuseExistingBranch ? config.branchName : config.baseBranch);
            if (res.lockFile === existingContent) {
                logger_1.logger.debug("pnpm-lock.yaml hasn't changed");
            }
            else {
                logger_1.logger.debug('pnpm-lock.yaml needs updating');
                updatedArtifacts.push({
                    type: 'addition',
                    path: pnpmShrinkwrap,
                    // TODO: can be undefined?
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                    contents: res.lockFile,
                });
            }
        }
        await resetNpmrcContent(lockFileDir, npmrcContent);
    }
    for (const lernaJsonFile of dirs.lernaJsonFiles) {
        let lockFile;
        logger_1.logger.debug(`Finding package.json for lerna location "${lernaJsonFile}"`);
        const lernaPackageFile = packageFiles.npm.find(
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        (p) => (0, fs_1.getSubDirectory)(p.packageFile) === (0, fs_1.getSubDirectory)(lernaJsonFile));
        // istanbul ignore if: not sure how to test
        if (!lernaPackageFile) {
            logger_1.logger.debug('No matching package.json found');
            throw new Error('lerna-no-lockfile');
        }
        if (lernaPackageFile.lernaClient === 'npm') {
            lockFile = config.npmLock || 'package-lock.json';
        }
        else {
            lockFile = config.yarnLock || 'yarn.lock';
        }
        const skipInstalls = lockFile === 'npm-shrinkwrap.json' ? false : config.skipInstalls;
        const learnaFileDir = (0, fs_1.getSubDirectory)(lernaJsonFile);
        const npmrcContent = await getNpmrcContent(learnaFileDir);
        await updateNpmrcContent(learnaFileDir, npmrcContent, additionalNpmrcContent);
        const res = await lerna.generateLockFiles(lernaPackageFile, (0, fs_1.getSubDirectory)(lernaJsonFile), config, env, skipInstalls);
        if (res.stderr) {
            // istanbul ignore if
            if (res.stderr.includes('ENOSPC: no space left on device')) {
                throw new Error(error_messages_1.SYSTEM_INSUFFICIENT_DISK_SPACE);
            }
            for (const upgrade of config.upgrades) {
                /* eslint-disable no-useless-escape */
                // istanbul ignore if: needs test
                if (res.stderr.includes(`Couldn't find any versions for \\\"${upgrade.depName}\\\"`)) {
                    logger_1.logger.debug({ dependency: upgrade.depName, type: 'yarn' }, 'lock file failed for the dependency being updated - skipping branch creation');
                    throw new external_host_error_1.ExternalHostError(Error('lock file failed for the dependency being updated - skipping branch creation'), npm_1.NpmDatasource.id);
                }
                /* eslint-enable no-useless-escape */
                // istanbul ignore if: needs test
                if (res.stderr.includes(`No matching version found for ${upgrade.depName}`)) {
                    logger_1.logger.debug({ dependency: upgrade.depName, type: 'npm' }, 'lock file failed for the dependency being updated - skipping branch creation');
                    throw new external_host_error_1.ExternalHostError(Error('lock file failed for the dependency being updated - skipping branch creation'), npm_1.NpmDatasource.id);
                }
            }
            artifactErrors.push({
                lockFile,
                stderr: res.stderr,
            });
        }
        else {
            for (const packageFile of packageFiles.npm) {
                const filename = packageFile.npmLock || packageFile.yarnLock;
                logger_1.logger.trace('Checking for ' + filename);
                const existingContent = await (0, git_1.getFile)(
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                filename, config.reuseExistingBranch ? config.branchName : config.baseBranch);
                if (existingContent) {
                    logger_1.logger.trace('Found lock file');
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                    const lockFilePath = filename;
                    logger_1.logger.trace('Checking against ' + lockFilePath);
                    try {
                        const newContent = (await (0, fs_1.readLocalFile)(lockFilePath, 'utf8')) ??
                            (await (0, fs_1.readLocalFile)(lockFilePath.replace('npm-shrinkwrap.json', 'package-lock.json'), 'utf8'));
                        // istanbul ignore if: needs test
                        if (newContent === existingContent) {
                            logger_1.logger.trace('File is unchanged');
                        }
                        else {
                            logger_1.logger.debug('File is updated: ' + lockFilePath);
                            updatedArtifacts.push({
                                type: 'addition',
                                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                                path: filename,
                                contents: newContent,
                            });
                        }
                    }
                    catch (err) /* istanbul ignore next */ {
                        if (config.updateType === 'lockFileMaintenance') {
                            logger_1.logger.debug({ packageFile, lockFilePath }, 'No lock file found after lerna lockFileMaintenance');
                        }
                        else {
                            logger_1.logger.warn({ packageFile, lockFilePath }, 'No lock file found after lerna bootstrap');
                        }
                    }
                }
                else {
                    logger_1.logger.trace('No lock file found');
                }
            }
        }
        await resetNpmrcContent(learnaFileDir, npmrcContent);
    }
    return { artifactErrors, updatedArtifacts };
}
exports.getAdditionalFiles = getAdditionalFiles;
//# sourceMappingURL=index.js.map