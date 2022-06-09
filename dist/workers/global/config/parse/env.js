"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = exports.getEnvName = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const json5_1 = tslib_1.__importDefault(require("json5"));
const options_1 = require("../../../../config/options");
const constants_1 = require("../../../../constants");
const logger_1 = require("../../../../logger");
function normalizePrefixes(env, prefix) {
    const result = { ...env };
    if (prefix) {
        for (const [key, val] of Object.entries(result)) {
            if (key.startsWith(prefix)) {
                const newKey = key.replace(prefix, 'RENOVATE_');
                result[newKey] = val;
                delete result[key];
            }
        }
    }
    return result;
}
function getEnvName(option) {
    if (option.env === false) {
        return '';
    }
    if (option.env) {
        return option.env;
    }
    const nameWithUnderscores = option.name.replace(/([A-Z])/g, '_$1');
    return `RENOVATE_${nameWithUnderscores.toUpperCase()}`;
}
exports.getEnvName = getEnvName;
const renameKeys = {
    azureAutoComplete: 'platformAutomerge',
    gitLabAutomerge: 'platformAutomerge', // migrate: gitLabAutomerge
};
function renameEnvKeys(env) {
    const result = { ...env };
    for (const [from, to] of Object.entries(renameKeys)) {
        const fromKey = getEnvName({ name: from });
        const toKey = getEnvName({ name: to });
        if (env[fromKey]) {
            result[toKey] = env[fromKey];
            delete result[fromKey];
        }
    }
    return result;
}
function getConfig(inputEnv) {
    let env = inputEnv;
    env = normalizePrefixes(inputEnv, inputEnv.ENV_PREFIX);
    env = renameEnvKeys(env);
    const options = (0, options_1.getOptions)();
    let config = {};
    if (env.RENOVATE_CONFIG) {
        try {
            config = json5_1.default.parse(env.RENOVATE_CONFIG);
            logger_1.logger.debug({ config }, 'Detected config in env RENOVATE_CONFIG');
        }
        catch (err) {
            logger_1.logger.fatal({ err }, 'Could not parse RENOVATE_CONFIG');
            process.exit(1);
        }
    }
    config.hostRules || (config.hostRules = []);
    const coersions = {
        boolean: (val) => val === 'true',
        array: (val) => val.split(',').map((el) => el.trim()),
        string: (val) => val.replace(/\\n/g, '\n'),
        object: (val) => json5_1.default.parse(val),
        integer: parseInt,
    };
    options.forEach((option) => {
        if (option.env !== false) {
            const envName = getEnvName(option);
            const envVal = env[envName];
            if (envVal) {
                if (option.type === 'array' && option.subType === 'object') {
                    try {
                        const parsed = json5_1.default.parse(envVal);
                        if (is_1.default.array(parsed)) {
                            config[option.name] = parsed;
                        }
                        else {
                            logger_1.logger.debug({ val: envVal, envName }, 'Could not parse object array');
                        }
                    }
                    catch (err) {
                        logger_1.logger.debug({ val: envVal, envName }, 'Could not parse environment variable');
                    }
                }
                else {
                    const coerce = coersions[option.type];
                    config[option.name] = coerce(envVal);
                    if (option.name === 'dryRun') {
                        if (config[option.name] === 'true') {
                            logger_1.logger.warn('env config dryRun property has been changed to full');
                            config[option.name] = 'full';
                        }
                        else if (config[option.name] === 'false') {
                            logger_1.logger.warn('env config dryRun property has been changed to null');
                            config[option.name] = null;
                        }
                        else if (config[option.name] === 'null') {
                            config[option.name] = null;
                        }
                    }
                    if (option.name === 'requireConfig') {
                        if (config[option.name] === 'true') {
                            logger_1.logger.warn('env config requireConfig property has been changed to required');
                            config[option.name] = 'required';
                        }
                        else if (config[option.name] === 'false') {
                            logger_1.logger.warn('env config requireConfig property has been changed to optional');
                            config[option.name] = 'optional';
                        }
                    }
                }
            }
        }
    });
    if (env.GITHUB_COM_TOKEN) {
        logger_1.logger.debug(`Converting GITHUB_COM_TOKEN into a global host rule`);
        config.hostRules.push({
            hostType: constants_1.PlatformId.Github,
            matchHost: 'github.com',
            token: env.GITHUB_COM_TOKEN,
        });
    }
    // These env vars are deprecated and deleted to make sure they're not used
    const unsupportedEnv = [
        'BITBUCKET_TOKEN',
        'BITBUCKET_USERNAME',
        'BITBUCKET_PASSWORD',
        'GITHUB_ENDPOINT',
        'GITHUB_TOKEN',
        'GITLAB_ENDPOINT',
        'GITLAB_TOKEN',
        'VSTS_ENDPOINT',
        'VSTS_TOKEN',
    ];
    unsupportedEnv.forEach((val) => delete env[val]);
    return config;
}
exports.getConfig = getConfig;
//# sourceMappingURL=env.js.map