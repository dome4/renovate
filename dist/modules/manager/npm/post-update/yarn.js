"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateLockFile = exports.isYarnUpdate = exports.getOptimizeCommand = exports.checkYarnrc = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const semver_1 = tslib_1.__importDefault(require("semver"));
const shlex_1 = require("shlex");
const upath_1 = tslib_1.__importDefault(require("upath"));
const global_1 = require("../../../../config/global");
const error_messages_1 = require("../../../../constants/error-messages");
const logger_1 = require("../../../../logger");
const external_host_error_1 = require("../../../../types/errors/external-host-error");
const exec_1 = require("../../../../util/exec");
const fs_1 = require("../../../../util/fs");
const regex_1 = require("../../../../util/regex");
const string_1 = require("../../../../util/string");
const npm_1 = require("../../../datasource/npm");
const node_version_1 = require("./node-version");
async function checkYarnrc(lockFileDir) {
    let offlineMirror = false;
    let yarnPath = null;
    try {
        const yarnrc = await (0, fs_1.readLocalFile)(upath_1.default.join(lockFileDir, '.yarnrc'), 'utf8');
        if (is_1.default.string(yarnrc)) {
            const mirrorLine = yarnrc
                .split(regex_1.newlineRegex)
                .find((line) => line.startsWith('yarn-offline-mirror '));
            offlineMirror = !!mirrorLine;
            const pathLine = yarnrc
                .split(regex_1.newlineRegex)
                .find((line) => line.startsWith('yarn-path '));
            if (pathLine) {
                yarnPath = pathLine.replace((0, regex_1.regEx)(/^yarn-path\s+"?(.+?)"?$/), '$1');
            }
            if (yarnPath) {
                // resolve binary relative to `yarnrc`
                yarnPath = upath_1.default.join(lockFileDir, yarnPath);
            }
            const yarnBinaryExists = yarnPath
                ? await (0, fs_1.localPathIsFile)(yarnPath)
                : false;
            if (!yarnBinaryExists) {
                const scrubbedYarnrc = yarnrc.replace((0, regex_1.regEx)(/^yarn-path\s+"?.+?"?$/gm), '');
                await (0, fs_1.writeLocalFile)(upath_1.default.join(lockFileDir, '.yarnrc'), scrubbedYarnrc);
                yarnPath = null;
            }
        }
    }
    catch (err) /* istanbul ignore next */ {
        // not found
    }
    return { offlineMirror, yarnPath };
}
exports.checkYarnrc = checkYarnrc;
function getOptimizeCommand(fileName = '/home/ubuntu/.npm-global/lib/node_modules/yarn/lib/cli.js') {
    return `sed -i 's/ steps,/ steps.slice(0,1),/' ${(0, shlex_1.quote)(fileName)}`;
}
exports.getOptimizeCommand = getOptimizeCommand;
function isYarnUpdate(upgrade) {
    return upgrade.depType === 'packageManager' && upgrade.depName === 'yarn';
}
exports.isYarnUpdate = isYarnUpdate;
async function generateLockFile(lockFileDir, env, config = {}, upgrades = []) {
    const lockFileName = upath_1.default.join(lockFileDir, 'yarn.lock');
    logger_1.logger.debug(`Spawning yarn install to create ${lockFileName}`);
    let lockFile = null;
    try {
        const toolConstraints = [];
        const yarnUpdate = upgrades.find(isYarnUpdate);
        const yarnCompatibility = yarnUpdate
            ? yarnUpdate.newValue
            : config.constraints?.yarn;
        const minYarnVersion = semver_1.default.validRange(yarnCompatibility) &&
            semver_1.default.minVersion(yarnCompatibility);
        const isYarn1 = !minYarnVersion || minYarnVersion.major === 1;
        const isYarnDedupeAvailable = minYarnVersion && semver_1.default.gte(minYarnVersion, '2.2.0');
        const isYarnModeAvailable = minYarnVersion && semver_1.default.gte(minYarnVersion, '3.0.0');
        const preCommands = [];
        const yarnTool = {
            toolName: 'yarn',
            constraint: '^1.22.18', // needs to be a v1 yarn, otherwise v2 will be installed
        };
        if (!isYarn1 && config.managerData?.hasPackageManager) {
            toolConstraints.push({ toolName: 'corepack' });
        }
        else {
            toolConstraints.push(yarnTool);
            if (isYarn1 && minYarnVersion) {
                yarnTool.constraint = yarnCompatibility;
            }
        }
        const extraEnv = {
            NPM_CONFIG_CACHE: env.NPM_CONFIG_CACHE,
            npm_config_store: env.npm_config_store,
            CI: 'true',
        };
        const commands = [];
        let cmdOptions = ''; // should have a leading space
        if (config.skipInstalls !== false) {
            if (isYarn1) {
                const { offlineMirror, yarnPath } = await checkYarnrc(lockFileDir);
                if (!offlineMirror) {
                    logger_1.logger.debug('Updating yarn.lock only - skipping node_modules');
                    // The following change causes Yarn 1.x to exit gracefully after updating the lock file but without installing node_modules
                    yarnTool.toolName = 'yarn-slim';
                    if (yarnPath) {
                        commands.push(getOptimizeCommand(yarnPath) + ' || true');
                    }
                }
            }
            else if (isYarnModeAvailable) {
                // Don't run the link step and only fetch what's necessary to compute an updated lockfile
                cmdOptions += ' --mode=update-lockfile';
            }
        }
        if (isYarn1) {
            cmdOptions +=
                ' --ignore-engines --ignore-platform --network-timeout 100000';
            extraEnv.YARN_CACHE_FOLDER = env.YARN_CACHE_FOLDER;
        }
        else {
            extraEnv.YARN_ENABLE_IMMUTABLE_INSTALLS = 'false';
            extraEnv.YARN_HTTP_TIMEOUT = '100000';
            extraEnv.YARN_GLOBAL_FOLDER = env.YARN_GLOBAL_FOLDER;
            if (!config.managerData?.yarnZeroInstall) {
                logger_1.logger.debug('Enabling global cache as zero-install is not detected');
                extraEnv.YARN_ENABLE_GLOBAL_CACHE = '1';
            }
        }
        if (!global_1.GlobalConfig.get('allowScripts') || config.ignoreScripts) {
            if (isYarn1) {
                cmdOptions += ' --ignore-scripts';
            }
            else if (isYarnModeAvailable) {
                if (config.skipInstalls === false) {
                    // Don't run the build scripts
                    cmdOptions += ' --mode=skip-build';
                }
            }
            else {
                extraEnv.YARN_ENABLE_SCRIPTS = '0';
            }
        }
        const tagConstraint = (0, node_version_1.getNodeUpdate)(upgrades) ?? (await (0, node_version_1.getNodeConstraint)(config));
        const execOptions = {
            cwdFile: lockFileName,
            extraEnv,
            docker: {
                image: 'node',
                tagScheme: 'node',
                tagConstraint,
            },
            preCommands,
            toolConstraints,
        };
        // istanbul ignore if
        if (global_1.GlobalConfig.get('exposeAllEnv')) {
            extraEnv.NPM_AUTH = env.NPM_AUTH;
            extraEnv.NPM_EMAIL = env.NPM_EMAIL;
        }
        if (yarnUpdate && !isYarn1) {
            logger_1.logger.debug('Updating Yarn binary');
            commands.push(`yarn set version ${yarnUpdate.newValue}`);
        }
        // This command updates the lock file based on package.json
        commands.push(`yarn install${cmdOptions}`);
        // rangeStrategy = update-lockfile
        const lockUpdates = upgrades.filter((upgrade) => upgrade.isLockfileUpdate);
        if (lockUpdates.length) {
            logger_1.logger.debug('Performing lockfileUpdate (yarn)');
            if (isYarn1) {
                // `yarn upgrade` updates based on the version range specified in the package file
                // note - this can hit a yarn bug, see https://github.com/yarnpkg/yarn/issues/8236
                commands.push(`yarn upgrade ${lockUpdates
                    .map((update) => update.depName)
                    .filter(is_1.default.string)
                    .filter(string_1.uniqueStrings)
                    .join(' ')}${cmdOptions}`);
            }
            else {
                // `yarn up` updates to the latest release, so the range should be specified
                commands.push(`yarn up ${lockUpdates
                    .map((update) => `${update.depName}@${update.newValue}`)
                    .filter(string_1.uniqueStrings)
                    .join(' ')}${cmdOptions}`);
            }
        }
        // postUpdateOptions
        ['fewer', 'highest'].forEach((s) => {
            if (config.postUpdateOptions?.includes(`yarnDedupe${s.charAt(0).toUpperCase()}${s.slice(1)}`)) {
                logger_1.logger.debug(`Performing yarn dedupe ${s}`);
                if (isYarn1) {
                    commands.push(`npx yarn-deduplicate --strategy ${s}`);
                    // Run yarn again in case any changes are necessary
                    commands.push(`yarn install${cmdOptions}`);
                }
                else if (isYarnDedupeAvailable && s === 'highest') {
                    commands.push(`yarn dedupe --strategy ${s}${cmdOptions}`);
                }
                else {
                    logger_1.logger.debug(`yarn dedupe ${s} not available`);
                }
            }
        });
        if (upgrades.find((upgrade) => upgrade.isLockFileMaintenance)) {
            logger_1.logger.debug(`Removing ${lockFileName} first due to lock file maintenance upgrade`);
            try {
                await (0, fs_1.deleteLocalFile)(lockFileName);
            }
            catch (err) /* istanbul ignore next */ {
                logger_1.logger.debug({ err, lockFileName }, 'Error removing yarn.lock for lock file maintenance');
            }
        }
        // Run the commands
        await (0, exec_1.exec)(commands, execOptions);
        // Read the result
        lockFile = await (0, fs_1.readLocalFile)(lockFileName, 'utf8');
    }
    catch (err) /* istanbul ignore next */ {
        if (err.message === error_messages_1.TEMPORARY_ERROR) {
            throw err;
        }
        logger_1.logger.debug({
            err,
            type: 'yarn',
        }, 'lock file error');
        if (err.stderr) {
            if (err.stderr.includes('ENOSPC: no space left on device')) {
                throw new Error(error_messages_1.SYSTEM_INSUFFICIENT_DISK_SPACE);
            }
            if (err.stderr.includes('The registry may be down.') ||
                err.stderr.includes('getaddrinfo ENOTFOUND registry.yarnpkg.com') ||
                err.stderr.includes('getaddrinfo ENOTFOUND registry.npmjs.org')) {
                throw new external_host_error_1.ExternalHostError(err, npm_1.NpmDatasource.id);
            }
        }
        return { error: true, stderr: err.stderr, stdout: err.stdout };
    }
    return { lockFile };
}
exports.generateLockFile = generateLockFile;
//# sourceMappingURL=yarn.js.map