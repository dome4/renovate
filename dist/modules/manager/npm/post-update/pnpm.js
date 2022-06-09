"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateLockFile = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const js_yaml_1 = require("js-yaml");
const upath_1 = tslib_1.__importDefault(require("upath"));
const global_1 = require("../../../../config/global");
const error_messages_1 = require("../../../../constants/error-messages");
const logger_1 = require("../../../../logger");
const exec_1 = require("../../../../util/exec");
const fs_1 = require("../../../../util/fs");
const node_version_1 = require("./node-version");
async function generateLockFile(lockFileDir, env, config, upgrades = []) {
    const lockFileName = upath_1.default.join(lockFileDir, 'pnpm-lock.yaml');
    logger_1.logger.debug(`Spawning pnpm install to create ${lockFileName}`);
    let lockFile = null;
    let stdout;
    let stderr;
    let cmd = 'pnpm';
    try {
        const pnpmToolConstraint = {
            toolName: 'pnpm',
            constraint: config.constraints?.pnpm ?? (await getPnpmContraint(lockFileDir)),
        };
        const tagConstraint = (0, node_version_1.getNodeUpdate)(upgrades) ?? (await (0, node_version_1.getNodeConstraint)(config));
        const extraEnv = {
            NPM_CONFIG_CACHE: env.NPM_CONFIG_CACHE,
            npm_config_store: env.npm_config_store,
        };
        const execOptions = {
            cwdFile: lockFileName,
            extraEnv,
            docker: {
                image: 'node',
                tagScheme: 'node',
                tagConstraint,
            },
            toolConstraints: [pnpmToolConstraint],
        };
        // istanbul ignore if
        if (global_1.GlobalConfig.get('exposeAllEnv')) {
            extraEnv.NPM_AUTH = env.NPM_AUTH;
            extraEnv.NPM_EMAIL = env.NPM_EMAIL;
        }
        cmd = 'pnpm';
        let args = 'install --recursive --lockfile-only';
        if (!global_1.GlobalConfig.get('allowScripts') || config.ignoreScripts) {
            args += ' --ignore-scripts';
            args += ' --ignore-pnpmfile';
        }
        logger_1.logger.debug({ cmd, args }, 'pnpm command');
        if (upgrades.find((upgrade) => upgrade.isLockFileMaintenance)) {
            logger_1.logger.debug(`Removing ${lockFileName} first due to lock file maintenance upgrade`);
            try {
                await (0, fs_1.deleteLocalFile)(lockFileName);
            }
            catch (err) /* istanbul ignore next */ {
                logger_1.logger.debug({ err, lockFileName }, 'Error removing yarn.lock for lock file maintenance');
            }
        }
        await (0, exec_1.exec)(`${cmd} ${args}`, execOptions);
        lockFile = await (0, fs_1.readLocalFile)(lockFileName, 'utf8');
    }
    catch (err) /* istanbul ignore next */ {
        if (err.message === error_messages_1.TEMPORARY_ERROR) {
            throw err;
        }
        logger_1.logger.debug({
            cmd,
            err,
            stdout,
            stderr,
            type: 'pnpm',
        }, 'lock file error');
        return { error: true, stderr: err.stderr, stdout: err.stdout };
    }
    return { lockFile };
}
exports.generateLockFile = generateLockFile;
async function getPnpmContraint(lockFileDir) {
    let result;
    const rootPackageJson = upath_1.default.join(lockFileDir, 'package.json');
    const content = await (0, fs_1.readLocalFile)(rootPackageJson, 'utf8');
    if (content) {
        const packageJson = JSON.parse(content);
        const packageManager = packageJson?.packageManager;
        if (packageManager?.includes('@')) {
            const nameAndVersion = packageManager.split('@');
            const name = nameAndVersion[0];
            if (name === 'pnpm') {
                result = nameAndVersion[1];
            }
        }
        else {
            const engines = packageJson?.engines;
            if (engines) {
                result = engines['pnpm'];
            }
        }
    }
    if (!result) {
        const lockFileName = upath_1.default.join(lockFileDir, 'pnpm-lock.yaml');
        const content = await (0, fs_1.readLocalFile)(lockFileName, 'utf8');
        if (content) {
            const pnpmLock = (0, js_yaml_1.load)(content);
            if (is_1.default.number(pnpmLock.lockfileVersion) &&
                pnpmLock.lockfileVersion < 5.4) {
                result = '<7';
            }
        }
    }
    return result;
}
//# sourceMappingURL=pnpm.js.map