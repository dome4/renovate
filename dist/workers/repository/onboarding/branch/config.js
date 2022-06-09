"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOnboardingConfigContents = exports.getOnboardingConfig = void 0;
const global_1 = require("../../../../config/global");
const local_1 = require("../../../../config/presets/local");
const util_1 = require("../../../../config/presets/util");
const logger_1 = require("../../../../logger");
const clone_1 = require("../../../../util/clone");
const json_writer_1 = require("../../../../util/json-writer");
async function getOnboardingConfig(config) {
    let onboardingConfig = (0, clone_1.clone)(config.onboardingConfig);
    let orgPreset;
    logger_1.logger.debug('Checking if this org/owner has a default Renovate preset which can be used.');
    const orgName = config.repository.split('/')[0];
    // Check for org/renovate-config
    try {
        const repo = `${orgName}/renovate-config`;
        await (0, local_1.getPreset)({ repo });
        orgPreset = `local>${repo}`;
    }
    catch (err) {
        if (err.message !== util_1.PRESET_DEP_NOT_FOUND &&
            !err.message.startsWith('Unsupported platform')) {
            logger_1.logger.warn({ err }, 'Unknown error fetching default owner preset');
        }
    }
    if (!orgPreset) {
        // Check for org/.{{platform}}
        const platform = global_1.GlobalConfig.get('platform');
        try {
            const repo = `${orgName}/.${platform}`;
            const presetName = 'renovate-config';
            await (0, local_1.getPreset)({
                repo,
                presetName,
            });
            orgPreset = `local>${repo}:${presetName}`;
        }
        catch (err) {
            if (err.message !== util_1.PRESET_DEP_NOT_FOUND &&
                !err.message.startsWith('Unsupported platform')) {
                logger_1.logger.warn({ err }, 'Unknown error fetching default owner preset');
            }
        }
    }
    if (orgPreset) {
        onboardingConfig = {
            $schema: 'https://docs.renovatebot.com/renovate-schema.json',
            extends: [orgPreset],
        };
    }
    else {
        // Organization preset did not exist
        logger_1.logger.debug('No default org/owner preset found, so the default onboarding config will be used instead. Note: do not be concerned with any 404 messages that preceded this.');
    }
    logger_1.logger.debug({ config: onboardingConfig }, 'onboarding config');
    return onboardingConfig;
}
exports.getOnboardingConfig = getOnboardingConfig;
async function getOnboardingConfigContents(config, fileName) {
    const codeFormat = await json_writer_1.EditorConfig.getCodeFormat(fileName);
    const jsonWriter = new json_writer_1.JSONWriter(codeFormat);
    const onboardingConfig = await getOnboardingConfig(config);
    return jsonWriter.write(onboardingConfig);
}
exports.getOnboardingConfigContents = getOnboardingConfigContents;
//# sourceMappingURL=config.js.map