"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = exports.getParsedContent = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const fs_extra_1 = tslib_1.__importDefault(require("fs-extra"));
const js_yaml_1 = require("js-yaml");
const json5_1 = tslib_1.__importDefault(require("json5"));
const upath_1 = tslib_1.__importDefault(require("upath"));
const migration_1 = require("../../../../config/migration");
const logger_1 = require("../../../../logger");
const fs_1 = require("../../../../util/fs");
async function getParsedContent(file) {
    switch (upath_1.default.extname(file)) {
        case '.yaml':
        case '.yml':
            return (0, js_yaml_1.load)(await (0, fs_1.readFile)(file, 'utf8'), {
                json: true,
            });
        case '.json5':
        case '.json':
            return json5_1.default.parse(await (0, fs_1.readFile)(file, 'utf8'));
        case '.js': {
            const tmpConfig = await Promise.resolve().then(() => tslib_1.__importStar(require(file)));
            let config = tmpConfig.default ? tmpConfig.default : tmpConfig;
            // Allow the config to be a function
            if (is_1.default.function_(config)) {
                config = config();
            }
            return config;
        }
        default:
            throw new Error('Unsupported file type');
    }
}
exports.getParsedContent = getParsedContent;
async function getConfig(env) {
    let configFile = env.RENOVATE_CONFIG_FILE ?? 'config.js';
    if (!upath_1.default.isAbsolute(configFile)) {
        configFile = `${process.cwd()}/${configFile}`;
    }
    if (env.RENOVATE_CONFIG_FILE && !(await fs_extra_1.default.pathExists(configFile))) {
        logger_1.logger.fatal({ configFile }, `Custom config file specified in RENOVATE_CONFIG_FILE must exist`);
        process.exit(1);
    }
    logger_1.logger.debug('Checking for config file in ' + configFile);
    let config = {};
    try {
        config = await getParsedContent(configFile);
    }
    catch (err) {
        // istanbul ignore if
        if (err instanceof SyntaxError || err instanceof TypeError) {
            logger_1.logger.fatal(`Could not parse config file \n ${err.stack}`);
            process.exit(1);
        }
        else if (err instanceof ReferenceError) {
            logger_1.logger.fatal(`Error parsing config file due to unresolved variable(s): ${err.message}`);
            process.exit(1);
        }
        else if (err.message === 'Unsupported file type') {
            logger_1.logger.fatal(err.message);
            process.exit(1);
        }
        else if (env.RENOVATE_CONFIG_FILE) {
            logger_1.logger.fatal('No custom config file found on disk');
            process.exit(1);
        }
        else {
            // istanbul ignore next: we can ignore this
            logger_1.logger.debug('No config file found on disk - skipping');
        }
    }
    const { isMigrated, migratedConfig } = (0, migration_1.migrateConfig)(config);
    if (isMigrated) {
        logger_1.logger.warn({ originalConfig: config, migratedConfig }, 'Config needs migrating');
        config = migratedConfig;
    }
    return config;
}
exports.getConfig = getConfig;
//# sourceMappingURL=file.js.map