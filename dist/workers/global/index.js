"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.start = exports.resolveGlobalExtends = exports.validatePresets = exports.getRepositoryConfig = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const bunyan_1 = require("bunyan");
const fs_extra_1 = tslib_1.__importDefault(require("fs-extra"));
const semver_1 = tslib_1.__importDefault(require("semver"));
const upath_1 = tslib_1.__importDefault(require("upath"));
const configParser = tslib_1.__importStar(require("../../config"));
const config_1 = require("../../config");
const global_1 = require("../../config/global");
const presets_1 = require("../../config/presets");
const secrets_1 = require("../../config/secrets");
const error_messages_1 = require("../../constants/error-messages");
const expose_cjs_1 = require("../../expose.cjs");
const logger_1 = require("../../logger");
const fs_1 = require("../../util/fs");
const hostRules = tslib_1.__importStar(require("../../util/host-rules"));
const repositoryWorker = tslib_1.__importStar(require("../repository"));
const autodiscover_1 = require("./autodiscover");
const parse_1 = require("./config/parse");
const initialize_1 = require("./initialize");
const limits_1 = require("./limits");
async function getRepositoryConfig(globalConfig, repository) {
    const repoConfig = configParser.mergeChildConfig(globalConfig, is_1.default.string(repository) ? { repository } : repository);
    const platform = global_1.GlobalConfig.get('platform');
    repoConfig.localDir = upath_1.default.join(repoConfig.baseDir, `./repos/${platform}/${repoConfig.repository}`);
    await fs_extra_1.default.ensureDir(repoConfig.localDir);
    delete repoConfig.baseDir;
    return configParser.filterConfig(repoConfig, 'repository');
}
exports.getRepositoryConfig = getRepositoryConfig;
function getGlobalConfig() {
    return (0, parse_1.parseConfigs)(process.env, process.argv);
}
function haveReachedLimits() {
    if ((0, limits_1.isLimitReached)(limits_1.Limit.Commits)) {
        logger_1.logger.info('Max commits created for this run.');
        return true;
    }
    return false;
}
/* istanbul ignore next */
function checkEnv() {
    const range = expose_cjs_1.pkg.engines.node;
    const rangeNext = expose_cjs_1.pkg['engines-next']?.node;
    if (process.release?.name !== 'node' || !process.versions?.node) {
        logger_1.logger.warn({ release: process.release, versions: process.versions }, 'Unknown node environment detected.');
    }
    else if (!semver_1.default.satisfies(process.versions?.node, range)) {
        logger_1.logger.error({ versions: process.versions, range }, 'Unsupported node environment detected. Please update your node version.');
    }
    else if (rangeNext &&
        !semver_1.default.satisfies(process.versions?.node, rangeNext)) {
        logger_1.logger.warn({ versions: process.versions }, `Please upgrade the version of Node.js used to run Renovate to satisfy "${rangeNext}". Support for your current version will be removed in Renovate's next major release.`);
    }
}
async function validatePresets(config) {
    logger_1.logger.debug('validatePresets()');
    try {
        await (0, presets_1.resolveConfigPresets)(config);
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.error({ err }, error_messages_1.CONFIG_PRESETS_INVALID);
        throw new Error(error_messages_1.CONFIG_PRESETS_INVALID);
    }
}
exports.validatePresets = validatePresets;
async function resolveGlobalExtends(globalExtends) {
    try {
        // Make a "fake" config to pass to resolveConfigPresets and resolve globalPresets
        const config = { extends: globalExtends };
        const resolvedConfig = await (0, presets_1.resolveConfigPresets)(config);
        return resolvedConfig;
    }
    catch (err) {
        logger_1.logger.error({ err }, 'Error resolving config preset');
        throw new Error(error_messages_1.CONFIG_PRESETS_INVALID);
    }
}
exports.resolveGlobalExtends = resolveGlobalExtends;
async function start() {
    let config;
    try {
        // read global config from file, env and cli args
        config = await getGlobalConfig();
        if (config?.globalExtends) {
            // resolve global presets immediately
            config = (0, config_1.mergeChildConfig)(config, await resolveGlobalExtends(config.globalExtends));
        }
        // initialize all submodules
        config = await (0, initialize_1.globalInitialize)(config);
        // Set platform and endpoint in case local presets are used
        global_1.GlobalConfig.set({ platform: config.platform, endpoint: config.endpoint });
        await validatePresets(config);
        checkEnv();
        // validate secrets. Will throw and abort if invalid
        (0, secrets_1.validateConfigSecrets)(config);
        // autodiscover repositories (needs to come after platform initialization)
        config = await (0, autodiscover_1.autodiscoverRepositories)(config);
        if (is_1.default.nonEmptyString(config.writeDiscoveredRepos)) {
            const content = JSON.stringify(config.repositories);
            await (0, fs_1.writeFile)(config.writeDiscoveredRepos, content);
            logger_1.logger.info(`Written discovered repositories to ${config.writeDiscoveredRepos}`);
            return 0;
        }
        // Iterate through repositories sequentially
        for (const repository of config.repositories) {
            if (haveReachedLimits()) {
                break;
            }
            const repoConfig = await getRepositoryConfig(config, repository);
            if (repoConfig.hostRules) {
                logger_1.logger.debug('Reinitializing hostRules for repo');
                hostRules.clear();
                repoConfig.hostRules.forEach((rule) => hostRules.add(rule));
                repoConfig.hostRules = [];
            }
            await repositoryWorker.renovateRepository(repoConfig);
            (0, logger_1.setMeta)({});
        }
    }
    catch (err) /* istanbul ignore next */ {
        if (err.message.startsWith('Init: ')) {
            logger_1.logger.fatal(err.message.substring(6));
        }
        else {
            logger_1.logger.fatal({ err }, `Fatal error: ${String(err.message)}`);
        }
        if (!config) {
            // return early if we can't parse config options
            logger_1.logger.debug(`Missing config`);
            return 2;
        }
    }
    finally {
        await (0, initialize_1.globalFinalize)(config);
        logger_1.logger.debug(`Renovate exiting`);
    }
    const loggerErrors = (0, logger_1.getProblems)().filter((p) => p.level >= bunyan_1.ERROR);
    if (loggerErrors.length) {
        logger_1.logger.info({ loggerErrors }, 'Renovate is exiting with a non-zero code due to the following logged errors');
        return 1;
    }
    return 0;
}
exports.start = start;
//# sourceMappingURL=index.js.map