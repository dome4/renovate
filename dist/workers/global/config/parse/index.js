"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseConfigs = void 0;
const tslib_1 = require("tslib");
const defaultsParser = tslib_1.__importStar(require("../../../../config/defaults"));
const utils_1 = require("../../../../config/utils");
const logger_1 = require("../../../../logger");
const manager_1 = require("../../../../modules/manager");
const fs_1 = require("../../../../util/fs");
const url_1 = require("../../../../util/url");
const cliParser = tslib_1.__importStar(require("./cli"));
const envParser = tslib_1.__importStar(require("./env"));
const fileParser = tslib_1.__importStar(require("./file"));
const host_rules_from_env_1 = require("./host-rules-from-env");
async function parseConfigs(env, argv) {
    logger_1.logger.debug('Parsing configs');
    // Get configs
    const defaultConfig = defaultsParser.getConfig();
    const fileConfig = await fileParser.getConfig(env);
    const cliConfig = cliParser.getConfig(argv);
    const envConfig = envParser.getConfig(env);
    let config = (0, utils_1.mergeChildConfig)(fileConfig, envConfig);
    config = (0, utils_1.mergeChildConfig)(config, cliConfig);
    const combinedConfig = config;
    config = (0, utils_1.mergeChildConfig)(defaultConfig, config);
    if (config.forceCli) {
        const forcedCli = { ...cliConfig };
        delete forcedCli.token;
        delete forcedCli.hostRules;
        if (config.force) {
            config.force = { ...config.force, ...forcedCli };
        }
        else {
            config.force = forcedCli;
        }
    }
    if (!config.privateKey && config.privateKeyPath) {
        config.privateKey = await (0, fs_1.readFile)(config.privateKeyPath, 'utf8');
        delete config.privateKeyPath;
    }
    if (!config.privateKeyOld && config.privateKeyPathOld) {
        config.privateKey = await (0, fs_1.readFile)(config.privateKeyPathOld, 'utf8');
        delete config.privateKeyPathOld;
    }
    if (config.logContext) {
        // This only has an effect if logContext was defined via file or CLI, otherwise it would already have been detected in env
        (0, logger_1.setContext)(config.logContext);
    }
    // Add file logger
    // istanbul ignore if
    if (config.logFile) {
        logger_1.logger.debug(`Enabling ${config.logFileLevel} logging to ${config.logFile}`);
        await (0, fs_1.ensureDir)((0, fs_1.getSubDirectory)(config.logFile));
        (0, logger_1.addStream)({
            name: 'logfile',
            path: config.logFile,
            level: config.logFileLevel,
        });
    }
    logger_1.logger.trace({ config: defaultConfig }, 'Default config');
    logger_1.logger.debug({ config: fileConfig }, 'File config');
    logger_1.logger.debug({ config: cliConfig }, 'CLI config');
    logger_1.logger.debug({ config: envConfig }, 'Env config');
    logger_1.logger.debug({ config: combinedConfig }, 'Combined config');
    if (config.detectGlobalManagerConfig) {
        logger_1.logger.debug('Detecting global manager config');
        const globalManagerConfig = await (0, manager_1.detectAllGlobalConfig)();
        logger_1.logger.debug({ config: globalManagerConfig }, 'Global manager config');
        config = (0, utils_1.mergeChildConfig)(config, globalManagerConfig);
    }
    if (config.detectHostRulesFromEnv) {
        const hostRules = (0, host_rules_from_env_1.hostRulesFromEnv)(env);
        config.hostRules = [...config.hostRules, ...hostRules];
    }
    // Get global config
    logger_1.logger.trace({ config }, 'Full config');
    // Print config
    logger_1.logger.trace({ config }, 'Global config');
    // Massage endpoint to have a trailing slash
    if (config.endpoint) {
        logger_1.logger.debug('Adding trailing slash to endpoint');
        config.endpoint = (0, url_1.ensureTrailingSlash)(config.endpoint);
    }
    // Remove log file entries
    delete config.logFile;
    delete config.logFileLevel;
    return config;
}
exports.parseConfigs = parseConfigs;
//# sourceMappingURL=index.js.map