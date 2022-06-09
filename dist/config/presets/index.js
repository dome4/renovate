"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveConfigPresets = exports.getPreset = exports.parsePreset = exports.replaceArgs = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const error_messages_1 = require("../../constants/error-messages");
const logger_1 = require("../../logger");
const external_host_error_1 = require("../../types/errors/external-host-error");
const clone_1 = require("../../util/clone");
const regex_1 = require("../../util/regex");
const massage = tslib_1.__importStar(require("../massage"));
const migration = tslib_1.__importStar(require("../migration"));
const utils_1 = require("../utils");
const common_1 = require("./common");
const gitea = tslib_1.__importStar(require("./gitea"));
const github = tslib_1.__importStar(require("./github"));
const gitlab = tslib_1.__importStar(require("./gitlab"));
const internal = tslib_1.__importStar(require("./internal"));
const local = tslib_1.__importStar(require("./local"));
const npm = tslib_1.__importStar(require("./npm"));
const util_1 = require("./util");
const presetSources = {
    github,
    npm,
    gitlab,
    gitea,
    local,
    internal,
};
const nonScopedPresetWithSubdirRegex = (0, regex_1.regEx)(/^(?<repo>~?[\w\-. /]+?)\/\/(?:(?<presetPath>[\w\-./]+)\/)?(?<presetName>[\w\-.]+)(?:#(?<tag>[\w\-./]+?))?$/);
const gitPresetRegex = (0, regex_1.regEx)(/^(?<repo>~?[\w\-. /]+)(?::(?<presetName>[\w\-.+/]+))?(?:#(?<tag>[\w\-./]+?))?$/);
function replaceArgs(obj, argMapping) {
    if (is_1.default.string(obj)) {
        let returnStr = obj;
        for (const [arg, argVal] of Object.entries(argMapping)) {
            const re = (0, regex_1.regEx)(`{{${arg}}}`, 'g', false);
            returnStr = returnStr.replace(re, argVal);
        }
        return returnStr;
    }
    if (is_1.default.array(obj)) {
        const returnArray = [];
        for (const item of obj) {
            returnArray.push(replaceArgs(item, argMapping));
        }
        return returnArray;
    }
    if (is_1.default.object(obj)) {
        const returnObj = {};
        for (const [key, val] of Object.entries(obj)) {
            returnObj[key] = replaceArgs(val, argMapping);
        }
        return returnObj;
    }
    return obj;
}
exports.replaceArgs = replaceArgs;
function parsePreset(input) {
    let str = input;
    let presetSource;
    let presetPath;
    let repo;
    let presetName;
    let tag;
    let params;
    if (str.startsWith('github>')) {
        presetSource = 'github';
        str = str.substring('github>'.length);
    }
    else if (str.startsWith('gitlab>')) {
        presetSource = 'gitlab';
        str = str.substring('gitlab>'.length);
    }
    else if (str.startsWith('gitea>')) {
        presetSource = 'gitea';
        str = str.substring('gitea>'.length);
    }
    else if (str.startsWith('local>')) {
        presetSource = 'local';
        str = str.substring('local>'.length);
    }
    else if (!str.startsWith('@') &&
        !str.startsWith(':') &&
        str.includes('/')) {
        presetSource = 'local';
    }
    str = str.replace((0, regex_1.regEx)(/^npm>/), '');
    presetSource = presetSource ?? 'npm';
    if (str.includes('(')) {
        params = str
            .slice(str.indexOf('(') + 1, -1)
            .split(',')
            .map((elem) => elem.trim());
        str = str.slice(0, str.indexOf('('));
    }
    const presetsPackages = [
        'compatibility',
        'config',
        'default',
        'docker',
        'group',
        'helpers',
        'monorepo',
        'npm',
        'packages',
        'preview',
        'regexManagers',
        'replacements',
        'schedule',
        'workarounds',
    ];
    if (presetsPackages.some((presetPackage) => str.startsWith(`${presetPackage}:`))) {
        presetSource = 'internal';
        [repo, presetName] = str.split(':');
    }
    else if (str.startsWith(':')) {
        // default namespace
        presetSource = 'internal';
        repo = 'default';
        presetName = str.slice(1);
    }
    else if (str.startsWith('@')) {
        // scoped namespace
        [, repo] = (0, regex_1.regEx)(/(@.*?)(:|$)/).exec(str);
        str = str.slice(repo.length);
        if (!repo.includes('/')) {
            repo += '/renovate-config';
        }
        if (str === '') {
            presetName = 'default';
        }
        else {
            presetName = str.slice(1);
        }
    }
    else if (str.includes('//')) {
        // non-scoped namespace with a subdirectory preset
        // Validation
        if (str.includes(':')) {
            throw new Error(util_1.PRESET_PROHIBITED_SUBPRESET);
        }
        if (!nonScopedPresetWithSubdirRegex.test(str)) {
            throw new Error(util_1.PRESET_INVALID);
        }
        ({ repo, presetPath, presetName, tag } =
            nonScopedPresetWithSubdirRegex.exec(str)?.groups || {});
    }
    else {
        ({ repo, presetName, tag } = gitPresetRegex.exec(str)?.groups || {});
        if (presetSource === 'npm' && !repo.startsWith('renovate-config-')) {
            repo = `renovate-config-${repo}`;
        }
        if (!is_1.default.nonEmptyString(presetName)) {
            presetName = 'default';
        }
    }
    return {
        presetSource,
        presetPath,
        repo,
        presetName,
        tag,
        params,
    };
}
exports.parsePreset = parsePreset;
async function getPreset(preset, baseConfig) {
    logger_1.logger.trace(`getPreset(${preset})`);
    // Check if the preset has been removed or replaced
    const newPreset = common_1.removedPresets[preset];
    if (newPreset) {
        return getPreset(newPreset, baseConfig);
    }
    if (newPreset === null) {
        return {};
    }
    const { presetSource, repo, presetPath, presetName, tag, params } = parsePreset(preset);
    let presetConfig = await presetSources[presetSource].getPreset({
        repo,
        presetPath,
        presetName,
        tag,
    });
    if (!presetConfig) {
        throw new Error(util_1.PRESET_DEP_NOT_FOUND);
    }
    logger_1.logger.trace({ presetConfig }, `Found preset ${preset}`);
    if (params) {
        const argMapping = {};
        for (const [index, value] of params.entries()) {
            argMapping[`arg${index}`] = value;
        }
        presetConfig = replaceArgs(presetConfig, argMapping);
    }
    logger_1.logger.trace({ presetConfig }, `Applied params to preset ${preset}`);
    const presetKeys = Object.keys(presetConfig);
    // istanbul ignore if
    if (presetKeys.length === 2 &&
        presetKeys.includes('description') &&
        presetKeys.includes('extends')) {
        // preset is just a collection of other presets
        delete presetConfig.description;
    }
    const packageListKeys = [
        'description',
        'matchPackageNames',
        'excludePackageNames',
        'matchPackagePatterns',
        'excludePackagePatterns',
        'matchPackagePrefixes',
        'excludePackagePrefixes',
    ];
    if (presetKeys.every((key) => packageListKeys.includes(key))) {
        delete presetConfig.description;
    }
    const { migratedConfig } = migration.migrateConfig(presetConfig);
    return massage.massageConfig(migratedConfig);
}
exports.getPreset = getPreset;
async function resolveConfigPresets(inputConfig, baseConfig, _ignorePresets, existingPresets = []) {
    let ignorePresets = (0, clone_1.clone)(_ignorePresets);
    if (!ignorePresets || ignorePresets.length === 0) {
        ignorePresets = inputConfig.ignorePresets || [];
    }
    logger_1.logger.trace({ config: inputConfig, existingPresets }, 'resolveConfigPresets');
    let config = {};
    // First, merge all the preset configs from left to right
    if (inputConfig.extends?.length) {
        for (const preset of inputConfig.extends) {
            // istanbul ignore if
            if (existingPresets.includes(preset)) {
                logger_1.logger.debug(`Already seen preset ${preset} in [${existingPresets.join(', ')}]`);
            }
            else if (ignorePresets.includes(preset)) {
                // istanbul ignore next
                logger_1.logger.debug(`Ignoring preset ${preset} in [${existingPresets.join(', ')}]`);
            }
            else {
                logger_1.logger.trace(`Resolving preset "${preset}"`);
                let fetchedPreset;
                try {
                    fetchedPreset = await getPreset(preset, baseConfig ?? inputConfig);
                }
                catch (err) {
                    logger_1.logger.debug({ preset, err }, 'Preset fetch error');
                    // istanbul ignore if
                    if (err instanceof external_host_error_1.ExternalHostError) {
                        throw err;
                    }
                    // istanbul ignore if
                    if (err.message === error_messages_1.PLATFORM_RATE_LIMIT_EXCEEDED) {
                        throw err;
                    }
                    const error = new Error(error_messages_1.CONFIG_VALIDATION);
                    if (err.message === util_1.PRESET_DEP_NOT_FOUND) {
                        error.validationError = `Cannot find preset's package (${preset})`;
                    }
                    else if (err.message === util_1.PRESET_RENOVATE_CONFIG_NOT_FOUND) {
                        error.validationError = `Preset package is missing a renovate-config entry (${preset})`;
                    }
                    else if (err.message === util_1.PRESET_NOT_FOUND) {
                        error.validationError = `Preset name not found within published preset config (${preset})`;
                    }
                    else if (err.message === util_1.PRESET_INVALID) {
                        error.validationError = `Preset is invalid (${preset})`;
                    }
                    else if (err.message === util_1.PRESET_PROHIBITED_SUBPRESET) {
                        error.validationError = `Sub-presets cannot be combined with a custom path (${preset})`;
                    }
                    else if (err.message === util_1.PRESET_INVALID_JSON) {
                        error.validationError = `Preset is invalid JSON (${preset})`;
                    }
                    else {
                        error.validationError = `Preset caused unexpected error (${preset})`;
                    }
                    // istanbul ignore if
                    if (existingPresets.length) {
                        error.validationError +=
                            '. Note: this is a *nested* preset so please contact the preset author if you are unable to fix it yourself.';
                    }
                    logger_1.logger.info({ validationError: error.validationError }, 'Throwing preset error');
                    throw error;
                }
                const presetConfig = await resolveConfigPresets(fetchedPreset, baseConfig ?? inputConfig, ignorePresets, existingPresets.concat([preset]));
                // istanbul ignore if
                if (inputConfig?.ignoreDeps?.length === 0) {
                    delete presetConfig.description;
                }
                config = (0, utils_1.mergeChildConfig)(config, presetConfig);
            }
        }
    }
    logger_1.logger.trace({ config }, `Post-preset resolve config`);
    // Now assign "regular" config on top
    config = (0, utils_1.mergeChildConfig)(config, inputConfig);
    delete config.extends;
    delete config.ignorePresets;
    logger_1.logger.trace({ config }, `Post-merge resolve config`);
    for (const [key, val] of Object.entries(config)) {
        const ignoredKeys = ['content', 'onboardingConfig'];
        if (is_1.default.array(val)) {
            // Resolve nested objects inside arrays
            config[key] = [];
            for (const element of val) {
                if (is_1.default.object(element)) {
                    config[key].push(await resolveConfigPresets(element, baseConfig, ignorePresets, existingPresets));
                }
                else {
                    config[key].push(element);
                }
            }
        }
        else if (is_1.default.object(val) && !ignoredKeys.includes(key)) {
            // Resolve nested objects
            logger_1.logger.trace(`Resolving object "${key}"`);
            config[key] = await resolveConfigPresets(val, baseConfig, ignorePresets, existingPresets);
        }
    }
    logger_1.logger.trace({ config: inputConfig }, 'Input config');
    logger_1.logger.trace({ config }, 'Resolved config');
    return config;
}
exports.resolveConfigPresets = resolveConfigPresets;
//# sourceMappingURL=index.js.map