"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeRenovateConfig = exports.checkForRepoConfigError = exports.detectRepoFileConfig = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const json_dup_key_validator_1 = tslib_1.__importDefault(require("json-dup-key-validator"));
const json5_1 = tslib_1.__importDefault(require("json5"));
const upath_1 = tslib_1.__importDefault(require("upath"));
const config_1 = require("../../../config");
const app_strings_1 = require("../../../config/app-strings");
const decrypt_1 = require("../../../config/decrypt");
const migrate_validate_1 = require("../../../config/migrate-validate");
const migration_1 = require("../../../config/migration");
const presets = tslib_1.__importStar(require("../../../config/presets"));
const secrets_1 = require("../../../config/secrets");
const error_messages_1 = require("../../../constants/error-messages");
const logger_1 = require("../../../logger");
const npmApi = tslib_1.__importStar(require("../../../modules/datasource/npm"));
const platform_1 = require("../../../modules/platform");
const repository_1 = require("../../../util/cache/repository");
const fs_1 = require("../../../util/fs");
const git_1 = require("../../../util/git");
const hostRules = tslib_1.__importStar(require("../../../util/host-rules"));
async function detectRepoFileConfig() {
    const cache = (0, repository_1.getCache)();
    let { configFileName } = cache;
    if (configFileName) {
        let configFileParsed = await platform_1.platform.getJsonFile(configFileName);
        if (configFileParsed) {
            if (configFileName === 'package.json') {
                configFileParsed = configFileParsed.renovate;
            }
            return { configFileName, configFileParsed };
        }
        logger_1.logger.debug('Existing config file no longer exists');
    }
    const fileList = await (0, git_1.getFileList)();
    async function detectConfigFile() {
        for (const fileName of app_strings_1.configFileNames) {
            if (fileName === 'package.json') {
                try {
                    const pJson = JSON.parse(await (0, fs_1.readLocalFile)('package.json', 'utf8'));
                    if (pJson.renovate) {
                        logger_1.logger.debug('Using package.json for global renovate config');
                        return 'package.json';
                    }
                }
                catch (err) {
                    // Do nothing
                }
            }
            else if (fileList.includes(fileName)) {
                return fileName;
            }
        }
        return null;
    }
    configFileName = (await detectConfigFile()) ?? undefined;
    if (!configFileName) {
        logger_1.logger.debug('No renovate config file found');
        return {};
    }
    cache.configFileName = configFileName;
    logger_1.logger.debug(`Found ${configFileName} config file`);
    let configFileParsed;
    if (configFileName === 'package.json') {
        // We already know it parses
        configFileParsed = JSON.parse(await (0, fs_1.readLocalFile)('package.json', 'utf8')).renovate;
        if (is_1.default.string(configFileParsed)) {
            logger_1.logger.debug('Massaging string renovate config to extends array');
            configFileParsed = { extends: [configFileParsed] };
        }
        logger_1.logger.debug({ config: configFileParsed }, 'package.json>renovate config');
    }
    else {
        let rawFileContents = await (0, fs_1.readLocalFile)(configFileName, 'utf8');
        // istanbul ignore if
        if (!is_1.default.string(rawFileContents)) {
            logger_1.logger.warn({ configFileName }, 'Null contents when reading config file');
            throw new Error(error_messages_1.REPOSITORY_CHANGED);
        }
        // istanbul ignore if
        if (!rawFileContents.length) {
            rawFileContents = '{}';
        }
        const fileType = upath_1.default.extname(configFileName);
        if (fileType === '.json5') {
            try {
                configFileParsed = json5_1.default.parse(rawFileContents);
            }
            catch (err) /* istanbul ignore next */ {
                logger_1.logger.debug({ renovateConfig: rawFileContents }, 'Error parsing renovate config renovate.json5');
                const validationError = 'Invalid JSON5 (parsing failed)';
                const validationMessage = `JSON5.parse error:  ${String(err.message)}`;
                return {
                    configFileName,
                    configFileParseError: { validationError, validationMessage },
                };
            }
        }
        else {
            let allowDuplicateKeys = true;
            let jsonValidationError = json_dup_key_validator_1.default.validate(rawFileContents, allowDuplicateKeys);
            if (jsonValidationError) {
                const validationError = 'Invalid JSON (parsing failed)';
                const validationMessage = jsonValidationError;
                return {
                    configFileName,
                    configFileParseError: { validationError, validationMessage },
                };
            }
            allowDuplicateKeys = false;
            jsonValidationError = json_dup_key_validator_1.default.validate(rawFileContents, allowDuplicateKeys);
            if (jsonValidationError) {
                const validationError = 'Duplicate keys in JSON';
                const validationMessage = JSON.stringify(jsonValidationError);
                return {
                    configFileName,
                    configFileParseError: { validationError, validationMessage },
                };
            }
            try {
                configFileParsed = json5_1.default.parse(rawFileContents);
            }
            catch (err) /* istanbul ignore next */ {
                logger_1.logger.debug({ renovateConfig: rawFileContents }, 'Error parsing renovate config');
                const validationError = 'Invalid JSON (parsing failed)';
                const validationMessage = `JSON.parse error:  ${String(err.message)}`;
                return {
                    configFileName,
                    configFileParseError: { validationError, validationMessage },
                };
            }
        }
        logger_1.logger.debug({ fileName: configFileName, config: configFileParsed }, 'Repository config');
    }
    return { configFileName, configFileParsed };
}
exports.detectRepoFileConfig = detectRepoFileConfig;
function checkForRepoConfigError(repoConfig) {
    if (!repoConfig.configFileParseError) {
        return;
    }
    const error = new Error(error_messages_1.CONFIG_VALIDATION);
    error.validationSource = repoConfig.configFileName;
    error.validationError = repoConfig.configFileParseError.validationError;
    error.validationMessage = repoConfig.configFileParseError.validationMessage;
    throw error;
}
exports.checkForRepoConfigError = checkForRepoConfigError;
// Check for repository config
async function mergeRenovateConfig(config) {
    let returnConfig = { ...config };
    let repoConfig = {};
    if (config.requireConfig !== 'ignored') {
        repoConfig = await detectRepoFileConfig();
    }
    const configFileParsed = repoConfig?.configFileParsed || {};
    if (is_1.default.nonEmptyArray(returnConfig.extends)) {
        configFileParsed.extends = [
            ...returnConfig.extends,
            ...(configFileParsed.extends || []),
        ];
        delete returnConfig.extends;
    }
    checkForRepoConfigError(repoConfig);
    const migratedConfig = await (0, migrate_validate_1.migrateAndValidate)(config, configFileParsed);
    if (migratedConfig.errors?.length) {
        const error = new Error(error_messages_1.CONFIG_VALIDATION);
        error.validationSource = repoConfig.configFileName;
        error.validationError =
            'The renovate configuration file contains some invalid settings';
        error.validationMessage = migratedConfig.errors
            .map((e) => e.message)
            .join(', ');
        throw error;
    }
    if (migratedConfig.warnings) {
        returnConfig.warnings = [
            ...(returnConfig.warnings || []),
            ...migratedConfig.warnings,
        ];
    }
    delete migratedConfig.errors;
    delete migratedConfig.warnings;
    logger_1.logger.debug({ config: migratedConfig }, 'migrated config');
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const repository = config.repository;
    // Decrypt before resolving in case we need npm authentication for any presets
    const decryptedConfig = await (0, decrypt_1.decryptConfig)(migratedConfig, repository);
    // istanbul ignore if
    if (is_1.default.string(decryptedConfig.npmrc)) {
        logger_1.logger.debug('Found npmrc in decrypted config - setting');
        npmApi.setNpmrc(decryptedConfig.npmrc);
    }
    // Decrypt after resolving in case the preset contains npm authentication instead
    let resolvedConfig = await (0, decrypt_1.decryptConfig)(await presets.resolveConfigPresets(decryptedConfig, config), repository);
    logger_1.logger.trace({ config: resolvedConfig }, 'resolved config');
    const migrationResult = (0, migration_1.migrateConfig)(resolvedConfig);
    if (migrationResult.isMigrated) {
        logger_1.logger.debug('Resolved config needs migrating');
        logger_1.logger.trace({ config: resolvedConfig }, 'resolved config after migrating');
        resolvedConfig = migrationResult.migratedConfig;
    }
    // istanbul ignore if
    if (is_1.default.string(resolvedConfig.npmrc)) {
        logger_1.logger.debug('Ignoring any .npmrc files in repository due to configured npmrc');
        npmApi.setNpmrc(resolvedConfig.npmrc);
    }
    resolvedConfig = (0, secrets_1.applySecretsToConfig)(resolvedConfig, (0, config_1.mergeChildConfig)(config.secrets || {}, resolvedConfig.secrets || {}));
    // istanbul ignore if
    if (resolvedConfig.hostRules) {
        logger_1.logger.debug('Setting hostRules from config');
        for (const rule of resolvedConfig.hostRules) {
            try {
                hostRules.add(rule);
            }
            catch (err) {
                logger_1.logger.warn({ err, config: rule }, 'Error setting hostRule from config');
            }
        }
        delete resolvedConfig.hostRules;
    }
    returnConfig = (0, config_1.mergeChildConfig)(returnConfig, resolvedConfig);
    returnConfig.renovateJsonPresent = true;
    // istanbul ignore if
    if (returnConfig.ignorePaths?.length) {
        logger_1.logger.debug({ ignorePaths: returnConfig.ignorePaths }, `Found repo ignorePaths`);
    }
    return returnConfig;
}
exports.mergeRenovateConfig = mergeRenovateConfig;
//# sourceMappingURL=merge.js.map