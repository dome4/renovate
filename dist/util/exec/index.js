"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exec = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const upath_1 = tslib_1.__importDefault(require("upath"));
const global_1 = require("../../config/global");
const error_messages_1 = require("../../constants/error-messages");
const logger_1 = require("../../logger");
const buildpack_1 = require("./buildpack");
const common_1 = require("./common");
const docker_1 = require("./docker");
const env_1 = require("./env");
function getChildEnv({ extraEnv, env: forcedEnv = {}, }) {
    const globalConfigEnv = global_1.GlobalConfig.get('customEnvVariables');
    const inheritedKeys = [];
    for (const [key, val] of Object.entries(extraEnv ?? {})) {
        if (is_1.default.string(val)) {
            inheritedKeys.push(key);
        }
    }
    const parentEnv = (0, env_1.getChildProcessEnv)(inheritedKeys);
    const combinedEnv = {
        ...extraEnv,
        ...parentEnv,
        ...globalConfigEnv,
        ...forcedEnv,
    };
    const result = {};
    for (const [key, val] of Object.entries(combinedEnv)) {
        if (is_1.default.string(val)) {
            result[key] = `${val}`;
        }
    }
    return result;
}
function dockerEnvVars(extraEnv, childEnv) {
    const extraEnvKeys = Object.keys(extraEnv || {});
    return extraEnvKeys.filter((key) => is_1.default.nonEmptyString(childEnv[key]));
}
function getCwd({ cwd, cwdFile }) {
    const defaultCwd = global_1.GlobalConfig.get('localDir');
    const paramCwd = cwdFile
        ? upath_1.default.join(defaultCwd, upath_1.default.dirname(cwdFile))
        : cwd;
    return paramCwd ?? defaultCwd;
}
function getRawExecOptions(opts) {
    const defaultExecutionTimeout = global_1.GlobalConfig.get('executionTimeout');
    const childEnv = getChildEnv(opts);
    const cwd = getCwd(opts);
    const rawExecOptions = {
        cwd,
        encoding: 'utf-8',
        env: childEnv,
        maxBuffer: opts.maxBuffer,
        timeout: opts.timeout,
    };
    // Set default timeout config.executionTimeout if specified; othrwise to 15 minutes
    if (!rawExecOptions.timeout) {
        if (defaultExecutionTimeout) {
            rawExecOptions.timeout = defaultExecutionTimeout * 60 * 1000;
        }
        else {
            rawExecOptions.timeout = 15 * 60 * 1000;
        }
    }
    // Set default max buffer size to 10MB
    rawExecOptions.maxBuffer = rawExecOptions.maxBuffer ?? 10 * 1024 * 1024;
    return rawExecOptions;
}
function isDocker(docker) {
    const { binarySource } = global_1.GlobalConfig.get();
    return binarySource === 'docker' && !!docker;
}
async function prepareRawExec(cmd, opts = {}) {
    const { docker } = opts;
    const { customEnvVariables } = global_1.GlobalConfig.get();
    const rawOptions = getRawExecOptions(opts);
    let rawCommands = typeof cmd === 'string' ? [cmd] : cmd;
    if (isDocker(docker)) {
        logger_1.logger.debug({ image: docker.image }, 'Using docker to execute');
        const extraEnv = { ...opts.extraEnv, ...customEnvVariables };
        const childEnv = getChildEnv(opts);
        const envVars = dockerEnvVars(extraEnv, childEnv);
        const cwd = getCwd(opts);
        const dockerOptions = { ...docker, cwd, envVars };
        const preCommands = [
            ...(await (0, buildpack_1.generateInstallCommands)(opts.toolConstraints)),
            ...(opts.preCommands ?? []),
        ];
        const dockerCommand = await (0, docker_1.generateDockerCommand)(rawCommands, preCommands, dockerOptions);
        rawCommands = [dockerCommand];
    }
    else if ((0, buildpack_1.isDynamicInstall)(opts.toolConstraints)) {
        logger_1.logger.debug('Using buildpack dynamic installs');
        rawCommands = [
            ...(await (0, buildpack_1.generateInstallCommands)(opts.toolConstraints)),
            ...rawCommands,
        ];
    }
    return { rawCommands, rawOptions };
}
async function exec(cmd, opts = {}) {
    const { docker } = opts;
    const dockerChildPrefix = global_1.GlobalConfig.get('dockerChildPrefix') ?? 'renovate_';
    const { rawCommands, rawOptions } = await prepareRawExec(cmd, opts);
    const useDocker = isDocker(docker);
    let res = { stdout: '', stderr: '' };
    for (const rawCmd of rawCommands) {
        const startTime = Date.now();
        if (useDocker) {
            await (0, docker_1.removeDockerContainer)(docker.image, dockerChildPrefix);
        }
        logger_1.logger.debug({ command: rawCmd }, 'Executing command');
        logger_1.logger.trace({ commandOptions: rawOptions }, 'Command options');
        try {
            res = await (0, common_1.rawExec)(rawCmd, rawOptions);
        }
        catch (err) {
            logger_1.logger.debug({ err }, 'rawExec err');
            if (useDocker) {
                await (0, docker_1.removeDockerContainer)(docker.image, dockerChildPrefix).catch((removeErr) => {
                    const message = err.message;
                    throw new Error(`Error: "${removeErr.message}" - Original Error: "${message}"`);
                });
            }
            if (err.signal === `SIGTERM`) {
                logger_1.logger.debug({ err }, 'exec interrupted by SIGTERM - run needs to be aborted');
                throw new Error(error_messages_1.TEMPORARY_ERROR);
            }
            throw err;
        }
        const durationMs = Math.round(Date.now() - startTime);
        logger_1.logger.debug({
            cmd: rawCmd,
            durationMs,
            stdout: res.stdout,
            stderr: res.stderr,
        }, 'exec completed');
    }
    return res;
}
exports.exec = exec;
//# sourceMappingURL=index.js.map