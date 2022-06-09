"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateAndValidate = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const logger_1 = require("../logger");
const configMassage = tslib_1.__importStar(require("./massage"));
const configMigration = tslib_1.__importStar(require("./migration"));
const configValidation = tslib_1.__importStar(require("./validation"));
async function migrateAndValidate(config, input) {
    logger_1.logger.debug('migrateAndValidate()');
    try {
        const { isMigrated, migratedConfig } = configMigration.migrateConfig(input);
        if (isMigrated) {
            logger_1.logger.debug({ oldConfig: input, newConfig: migratedConfig }, 'Config migration necessary');
        }
        else {
            logger_1.logger.debug('No config migration necessary');
        }
        const massagedConfig = configMassage.massageConfig(migratedConfig);
        logger_1.logger.debug({ config: massagedConfig }, 'massaged config');
        const { warnings, errors, } = await configValidation.validateConfig(massagedConfig);
        // istanbul ignore if
        if (is_1.default.nonEmptyArray(warnings)) {
            logger_1.logger.warn({ warnings }, 'Found renovate config warnings');
        }
        if (is_1.default.nonEmptyArray(errors)) {
            logger_1.logger.info({ errors }, 'Found renovate config errors');
        }
        massagedConfig.errors = (config.errors || []).concat(errors);
        if (!config.repoIsOnboarded) {
            massagedConfig.warnings = (config.warnings || []).concat(warnings);
        }
        return massagedConfig;
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.debug({ config: input }, 'migrateAndValidate error');
        throw err;
    }
}
exports.migrateAndValidate = migrateAndValidate;
//# sourceMappingURL=migrate-validate.js.map