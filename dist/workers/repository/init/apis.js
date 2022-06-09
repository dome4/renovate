"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initApis = void 0;
const app_strings_1 = require("../../../config/app-strings");
const error_messages_1 = require("../../../constants/error-messages");
const platform_1 = require("../../../modules/platform");
const defaultConfigFile = (config) => app_strings_1.configFileNames.includes(config.onboardingConfigFileName)
    ? config.onboardingConfigFileName
    : app_strings_1.configFileNames[0];
async function getJsonFile(file) {
    try {
        return await platform_1.platform.getJsonFile(file);
    }
    catch (err) {
        return null;
    }
}
async function validateOptimizeForDisabled(config) {
    if (config.optimizeForDisabled) {
        const renovateConfig = await getJsonFile(defaultConfigFile(config));
        if (renovateConfig?.enabled === false) {
            throw new Error(error_messages_1.REPOSITORY_DISABLED_BY_CONFIG);
        }
    }
}
async function validateIncludeForks(config) {
    if (!config.includeForks && config.isFork) {
        const renovateConfig = await getJsonFile(defaultConfigFile(config));
        if (!renovateConfig?.includeForks) {
            throw new Error(error_messages_1.REPOSITORY_FORKED);
        }
    }
}
// TODO: fix types
async function getPlatformConfig(config) {
    const platformConfig = await platform_1.platform.initRepo(config);
    return {
        ...config,
        ...platformConfig,
    };
}
// TODO: fix types
async function initApis(input) {
    let config = { ...input };
    config = await getPlatformConfig(config);
    await validateOptimizeForDisabled(config);
    await validateIncludeForks(config);
    return config;
}
exports.initApis = initApis;
//# sourceMappingURL=apis.js.map