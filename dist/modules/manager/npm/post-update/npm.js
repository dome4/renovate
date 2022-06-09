"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateLockFile = void 0;
const tslib_1 = require("tslib");
const upath_1 = tslib_1.__importDefault(require("upath"));
const global_1 = require("../../../../config/global");
const error_messages_1 = require("../../../../constants/error-messages");
const logger_1 = require("../../../../logger");
const exec_1 = require("../../../../util/exec");
const fs_1 = require("../../../../util/fs");
const utils_1 = require("../utils");
const node_version_1 = require("./node-version");
async function generateLockFile(lockFileDir, env, filename, config = {}, upgrades = []) {
    // TODO: don't assume package-lock.json is in the same directory
    const lockFileName = upath_1.default.join(lockFileDir, filename);
    logger_1.logger.debug(`Spawning npm install to create ${lockFileDir}/${filename}`);
    const { skipInstalls, postUpdateOptions } = config;
    let lockFile = null;
    try {
        const npmToolConstraint = {
            toolName: 'npm',
            constraint: config.constraints?.npm,
        };
        const commands = [];
        let cmdOptions = '';
        if (postUpdateOptions?.includes('npmDedupe') || skipInstalls === false) {
            logger_1.logger.debug('Performing node_modules install');
            cmdOptions += '--no-audit';
        }
        else {
            logger_1.logger.debug('Updating lock file only');
            cmdOptions += '--package-lock-only --no-audit';
        }
        if (!global_1.GlobalConfig.get('allowScripts') || config.ignoreScripts) {
            cmdOptions += ' --ignore-scripts';
        }
        const tagConstraint = (0, node_version_1.getNodeUpdate)(upgrades) ?? (await (0, node_version_1.getNodeConstraint)(config));
        const extraEnv = {
            NPM_CONFIG_CACHE: env.NPM_CONFIG_CACHE,
            npm_config_store: env.npm_config_store,
        };
        const execOptions = {
            cwdFile: lockFileName,
            extraEnv,
            toolConstraints: [npmToolConstraint],
            docker: {
                image: 'node',
                tagScheme: 'node',
                tagConstraint,
            },
        };
        // istanbul ignore if
        if (global_1.GlobalConfig.get('exposeAllEnv')) {
            extraEnv.NPM_AUTH = env.NPM_AUTH;
            extraEnv.NPM_EMAIL = env.NPM_EMAIL;
        }
        if (!upgrades.every((upgrade) => upgrade.isLockfileUpdate)) {
            // This command updates the lock file based on package.json
            commands.push(`npm install ${cmdOptions}`.trim());
        }
        // rangeStrategy = update-lockfile
        const lockUpdates = upgrades.filter((upgrade) => upgrade.isLockfileUpdate);
        if (lockUpdates.length) {
            logger_1.logger.debug('Performing lockfileUpdate (npm)');
            const updateCmd = `npm install ${cmdOptions}` +
                lockUpdates
                    .map((update) => ` ${update.depName}@${update.newVersion}`)
                    .join('');
            commands.push(updateCmd);
        }
        if (upgrades.some((upgrade) => upgrade.isRemediation)) {
            // We need to run twice to get the correct lock file
            commands.push(`npm install ${cmdOptions}`.trim());
        }
        // postUpdateOptions
        if (config.postUpdateOptions?.includes('npmDedupe')) {
            logger_1.logger.debug('Performing npm dedupe');
            commands.push('npm dedupe');
        }
        if (upgrades.find((upgrade) => upgrade.isLockFileMaintenance)) {
            logger_1.logger.debug(`Removing ${lockFileName} first due to lock file maintenance upgrade`);
            try {
                await (0, fs_1.deleteLocalFile)(lockFileName);
            }
            catch (err) /* istanbul ignore next */ {
                logger_1.logger.debug({ err, lockFileName }, 'Error removing package-lock.json for lock file maintenance');
            }
        }
        // Run the commands
        await (0, exec_1.exec)(commands, execOptions);
        // massage to shrinkwrap if necessary
        if (filename === 'npm-shrinkwrap.json' &&
            (await (0, fs_1.localPathExists)(upath_1.default.join(lockFileDir, 'package-lock.json')))) {
            await (0, fs_1.renameLocalFile)(upath_1.default.join(lockFileDir, 'package-lock.json'), upath_1.default.join(lockFileDir, 'npm-shrinkwrap.json'));
        }
        // Read the result
        lockFile = await (0, fs_1.readLocalFile)(upath_1.default.join(lockFileDir, filename), 'utf8');
        // Massage lockfile counterparts of package.json that were modified
        // because npm install was called with an explicit version for rangeStrategy=update-lockfile
        if (lockUpdates.length) {
            const { detectedIndent, lockFileParsed } = (0, utils_1.parseLockFile)(lockFile);
            if (lockFileParsed?.lockfileVersion === 2) {
                lockUpdates.forEach((lockUpdate) => {
                    const depType = lockUpdate.depType;
                    if (lockFileParsed.packages?.['']?.[depType]?.[
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                    lockUpdate.depName]) {
                        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                        lockFileParsed.packages[''][depType][lockUpdate.depName] =
                            lockUpdate.newValue;
                    }
                });
                lockFile = (0, utils_1.composeLockFile)(lockFileParsed, detectedIndent);
            }
        }
    }
    catch (err) /* istanbul ignore next */ {
        if (err.message === error_messages_1.TEMPORARY_ERROR) {
            throw err;
        }
        logger_1.logger.debug({
            err,
            type: 'npm',
        }, 'lock file error');
        if (err.stderr?.includes('ENOSPC: no space left on device')) {
            throw new Error(error_messages_1.SYSTEM_INSUFFICIENT_DISK_SPACE);
        }
        return { error: true, stderr: err.stderr };
    }
    return { lockFile };
}
exports.generateLockFile = generateLockFile;
//# sourceMappingURL=npm.js.map