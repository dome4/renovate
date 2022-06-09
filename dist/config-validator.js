#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// istanbul ignore file
const dequal_1 = require("dequal");
const fs_extra_1 = require("fs-extra");
const app_strings_1 = require("./config/app-strings");
const massage_1 = require("./config/massage");
const migration_1 = require("./config/migration");
const validation_1 = require("./config/validation");
const logger_1 = require("./logger");
const file_1 = require("./workers/global/config/parse/file");
let returnVal = 0;
/* eslint-disable no-console */
async function validate(desc, config, isPreset = false) {
    const { isMigrated, migratedConfig } = (0, migration_1.migrateConfig)(config);
    if (isMigrated) {
        logger_1.logger.warn({
            oldConfig: config,
            newConfig: migratedConfig,
        }, 'Config migration necessary');
    }
    const massagedConfig = (0, massage_1.massageConfig)(migratedConfig);
    const res = await (0, validation_1.validateConfig)(massagedConfig, isPreset);
    if (res.errors.length) {
        logger_1.logger.error({ errors: res.errors }, `${desc} contains errors`);
        returnVal = 1;
    }
    if (res.warnings.length) {
        logger_1.logger.warn({ warnings: res.warnings }, `${desc} contains warnings`);
        returnVal = 1;
    }
}
(async () => {
    for (const file of app_strings_1.configFileNames.filter((name) => name !== 'package.json')) {
        try {
            if (!(await (0, fs_extra_1.pathExists)(file))) {
                continue;
            }
            const parsedContent = await (0, file_1.getParsedContent)(file);
            try {
                logger_1.logger.info(`Validating ${file}`);
                await validate(file, parsedContent);
            }
            catch (err) {
                logger_1.logger.warn({ err }, `${file} is not valid Renovate config`);
                returnVal = 1;
            }
        }
        catch (err) {
            logger_1.logger.warn({ err }, `${file} could not be parsed`);
            returnVal = 1;
        }
    }
    try {
        const pkgJson = JSON.parse(await (0, fs_extra_1.readFile)('package.json', 'utf8'));
        if (pkgJson.renovate) {
            logger_1.logger.info(`Validating package.json > renovate`);
            await validate('package.json > renovate', pkgJson.renovate);
        }
        if (pkgJson['renovate-config']) {
            logger_1.logger.info(`Validating package.json > renovate-config`);
            for (const presetConfig of Object.values(pkgJson['renovate-config'])) {
                await validate('package.json > renovate-config', presetConfig, true);
            }
        }
    }
    catch (err) {
        // ignore
    }
    try {
        const fileConfig = await (0, file_1.getConfig)(process.env);
        if (!(0, dequal_1.dequal)(fileConfig, {})) {
            const file = process.env.RENOVATE_CONFIG_FILE ?? 'config.js';
            logger_1.logger.info(`Validating ${file}`);
            try {
                await validate(file, fileConfig);
            }
            catch (err) {
                logger_1.logger.error({ err }, `${file} is not valid Renovate config`);
                returnVal = 1;
            }
        }
    }
    catch (err) {
        // ignore
    }
    if (returnVal !== 0) {
        process.exit(returnVal);
    }
    logger_1.logger.info('Config validated successfully');
})().catch((e) => {
    console.error(e);
    process.exit(99);
});
//# sourceMappingURL=config-validator.js.map