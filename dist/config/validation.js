"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateConfig = exports.getParentName = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const manager_1 = require("../modules/manager");
const regex_1 = require("../util/regex");
const template = tslib_1.__importStar(require("../util/template"));
const schedule_1 = require("../workers/repository/update/branch/schedule");
const migration_1 = require("./migration");
const options_1 = require("./options");
const presets_1 = require("./presets");
const managerValidator = tslib_1.__importStar(require("./validation-helpers/managers"));
const options = (0, options_1.getOptions)();
let optionTypes;
let optionParents;
const managerList = (0, manager_1.getManagerList)();
const topLevelObjects = (0, manager_1.getLanguageList)().concat((0, manager_1.getManagerList)());
const ignoredNodes = [
    '$schema',
    'depType',
    'npmToken',
    'packageFile',
    'forkToken',
    'repository',
    'vulnerabilityAlertsOnly',
    'vulnerabilityAlert',
    'isVulnerabilityAlert',
    'copyLocalLibs',
    'prBody',
    'minimumConfidence', // undocumented feature flag
];
const tzRe = (0, regex_1.regEx)(/^:timezone\((.+)\)$/);
const rulesRe = (0, regex_1.regEx)(/p.*Rules\[\d+\]$/);
function isManagerPath(parentPath) {
    return ((0, regex_1.regEx)(/^regexManagers\[[0-9]+]$/).test(parentPath) ||
        managerList.includes(parentPath));
}
function isIgnored(key) {
    return ignoredNodes.includes(key);
}
function validateAliasObject(val) {
    for (const [key, value] of Object.entries(val)) {
        if (!is_1.default.urlString(value)) {
            return key;
        }
    }
    return true;
}
function validatePlainObject(val) {
    for (const [key, value] of Object.entries(val)) {
        if (!is_1.default.string(value)) {
            return key;
        }
    }
    return true;
}
function getUnsupportedEnabledManagers(enabledManagers) {
    return enabledManagers.filter((manager) => !(0, manager_1.getManagerList)().includes(manager));
}
function getDeprecationMessage(option) {
    const deprecatedOptions = {
        branchName: `Direct editing of branchName is now deprecated. Please edit branchPrefix, additionalBranchPrefix, or branchTopic instead`,
        commitMessage: `Direct editing of commitMessage is now deprecated. Please edit commitMessage's subcomponents instead.`,
        prTitle: `Direct editing of prTitle is now deprecated. Please edit commitMessage subcomponents instead as they will be passed through to prTitle.`,
    };
    return deprecatedOptions[option];
}
function getParentName(parentPath) {
    return parentPath
        ? parentPath
            .replace((0, regex_1.regEx)(/\.?encrypted$/), '')
            .replace((0, regex_1.regEx)(/\[\d+\]$/), '')
            .split('.')
            .pop()
        : '.';
}
exports.getParentName = getParentName;
async function validateConfig(config, isPreset, parentPath) {
    if (!optionTypes) {
        optionTypes = {};
        options.forEach((option) => {
            optionTypes[option.name] = option.type;
        });
    }
    if (!optionParents) {
        optionParents = {};
        options.forEach((option) => {
            if (option.parent) {
                optionParents[option.name] = option.parent;
            }
        });
    }
    let errors = [];
    let warnings = [];
    for (const [key, val] of Object.entries(config)) {
        const currentPath = parentPath ? `${parentPath}.${key}` : key;
        // istanbul ignore if
        if (key === '__proto__') {
            errors.push({
                topic: 'Config security error',
                message: '__proto__',
            });
            continue;
        }
        if (parentPath && topLevelObjects.includes(key)) {
            errors.push({
                topic: 'Configuration Error',
                message: `The "${key}" object can only be configured at the top level of a config but was found inside "${parentPath}"`,
            });
        }
        if (key === 'enabledManagers' && val) {
            const unsupportedManagers = getUnsupportedEnabledManagers(val);
            if (is_1.default.nonEmptyArray(unsupportedManagers)) {
                errors.push({
                    topic: 'Configuration Error',
                    message: `The following managers configured in enabledManagers are not supported: "${unsupportedManagers.join(', ')}"`,
                });
            }
        }
        if (key === 'fileMatch') {
            if (parentPath === undefined) {
                errors.push({
                    topic: 'Config error',
                    message: `"fileMatch" may not be defined at the top level of a config and must instead be within a manager block`,
                });
            }
            else if (!isManagerPath(parentPath)) {
                warnings.push({
                    topic: 'Config warning',
                    message: `"fileMatch" must be configured in a manager block and not here: ${parentPath}`,
                });
            }
        }
        if (!isIgnored(key) && // We need to ignore some reserved keys
            !is_1.default.function(val) // Ignore all functions
        ) {
            if (getDeprecationMessage(key)) {
                warnings.push({
                    topic: 'Deprecation Warning',
                    message: getDeprecationMessage(key),
                });
            }
            const templateKeys = [
                'branchName',
                'commitBody',
                'commitMessage',
                'prTitle',
                'semanticCommitScope',
            ];
            if ((key.endsWith('Template') || templateKeys.includes(key)) && val) {
                try {
                    // TODO: validate string #7154
                    let res = template.compile(val.toString(), config, false);
                    res = template.compile(res, config, false);
                    template.compile(res, config, false);
                }
                catch (err) {
                    errors.push({
                        topic: 'Configuration Error',
                        message: `Invalid template in config path: ${currentPath}`,
                    });
                }
            }
            const parentName = getParentName(parentPath);
            if (!isPreset &&
                optionParents[key] &&
                optionParents[key] !== parentName) {
                const message = `${key} should only be configured within a "${optionParents[key]}" object. Was found in ${parentName}`;
                warnings.push({
                    topic: `${parentPath ? `${parentPath}.` : ''}${key}`,
                    message,
                });
            }
            if (!optionTypes[key]) {
                errors.push({
                    topic: 'Configuration Error',
                    message: `Invalid configuration option: ${currentPath}`,
                });
            }
            else if (key === 'schedule') {
                const [validSchedule, errorMessage] = (0, schedule_1.hasValidSchedule)(val);
                if (!validSchedule) {
                    errors.push({
                        topic: 'Configuration Error',
                        message: `Invalid ${currentPath}: \`${errorMessage}\``,
                    });
                }
            }
            else if (['allowedVersions', 'matchCurrentVersion'].includes(key) &&
                (0, regex_1.isConfigRegex)(val)) {
                if (!(0, regex_1.configRegexPredicate)(val)) {
                    errors.push({
                        topic: 'Configuration Error',
                        message: `Invalid regExp for ${currentPath}: \`${val}\``,
                    });
                }
            }
            else if (key === 'timezone' && val !== null) {
                const [validTimezone, errorMessage] = (0, schedule_1.hasValidTimezone)(val);
                if (!validTimezone) {
                    errors.push({
                        topic: 'Configuration Error',
                        message: `${currentPath}: ${errorMessage}`,
                    });
                }
            }
            else if (val !== null) {
                const type = optionTypes[key];
                if (type === 'boolean') {
                    if (val !== true && val !== false) {
                        errors.push({
                            topic: 'Configuration Error',
                            message: `Configuration option \`${currentPath}\` should be boolean. Found: ${JSON.stringify(val)} (${typeof val})`,
                        });
                    }
                }
                else if (type === 'integer') {
                    if (!is_1.default.number(val)) {
                        errors.push({
                            topic: 'Configuration Error',
                            message: `Configuration option \`${currentPath}\` should be an integer. Found: ${JSON.stringify(val)} (${typeof val})`,
                        });
                    }
                }
                else if (type === 'array' && val) {
                    if (is_1.default.array(val)) {
                        for (const [subIndex, subval] of val.entries()) {
                            if (is_1.default.object(subval)) {
                                const subValidation = await validateConfig(subval, isPreset, `${currentPath}[${subIndex}]`);
                                warnings = warnings.concat(subValidation.warnings);
                                errors = errors.concat(subValidation.errors);
                            }
                        }
                        if (key === 'extends') {
                            for (const subval of val) {
                                if (is_1.default.string(subval)) {
                                    if (parentName === 'packageRules' &&
                                        subval.startsWith('group:')) {
                                        warnings.push({
                                            topic: 'Configuration Warning',
                                            message: `${currentPath}: you should not extend "group:" presets`,
                                        });
                                    }
                                    if (tzRe.test(subval)) {
                                        const [, timezone] = tzRe.exec(subval);
                                        const [validTimezone, errorMessage] = (0, schedule_1.hasValidTimezone)(timezone);
                                        if (!validTimezone) {
                                            errors.push({
                                                topic: 'Configuration Error',
                                                message: `${currentPath}: ${errorMessage}`,
                                            });
                                        }
                                    }
                                }
                                else {
                                    errors.push({
                                        topic: 'Configuration Warning',
                                        message: `${currentPath}: preset value is not a string`,
                                    });
                                }
                            }
                        }
                        const selectors = [
                            'matchFiles',
                            'matchPaths',
                            'matchLanguages',
                            'matchBaseBranches',
                            'matchManagers',
                            'matchDatasources',
                            'matchDepTypes',
                            'matchPackageNames',
                            'matchPackagePatterns',
                            'matchPackagePrefixes',
                            'excludePackageNames',
                            'excludePackagePatterns',
                            'excludePackagePrefixes',
                            'matchCurrentVersion',
                            'matchSourceUrlPrefixes',
                            'matchSourceUrls',
                            'matchUpdateTypes',
                        ];
                        if (key === 'packageRules') {
                            for (const [subIndex, packageRule] of val.entries()) {
                                if (is_1.default.object(packageRule)) {
                                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                                    const resolvedRule = (0, migration_1.migrateConfig)({
                                        packageRules: [
                                            await (0, presets_1.resolveConfigPresets)(packageRule, config),
                                        ],
                                    }).migratedConfig.packageRules[0];
                                    errors.push(...managerValidator.check({ resolvedRule, currentPath }));
                                    const selectorLength = Object.keys(resolvedRule).filter((ruleKey) => selectors.includes(ruleKey)).length;
                                    if (!selectorLength) {
                                        const message = `${currentPath}[${subIndex}]: Each packageRule must contain at least one match* or exclude* selector. Rule: ${JSON.stringify(packageRule)}`;
                                        errors.push({
                                            topic: 'Configuration Error',
                                            message,
                                        });
                                    }
                                    if (selectorLength === Object.keys(resolvedRule).length) {
                                        const message = `${currentPath}[${subIndex}]: Each packageRule must contain at least one non-match* or non-exclude* field. Rule: ${JSON.stringify(packageRule)}`;
                                        warnings.push({
                                            topic: 'Configuration Error',
                                            message,
                                        });
                                    }
                                    // It's too late to apply any of these options once you already have updates determined
                                    const preLookupOptions = [
                                        'allowedVersions',
                                        'extractVersion',
                                        'followTag',
                                        'ignoreDeps',
                                        'ignoreUnstable',
                                        'rangeStrategy',
                                        'registryUrls',
                                        'respectLatest',
                                        'rollbackPrs',
                                        'separateMajorMinor',
                                        'separateMinorPatch',
                                        'separateMultipleMajor',
                                        'versioning',
                                    ];
                                    if (is_1.default.nonEmptyArray(resolvedRule.matchUpdateTypes)) {
                                        for (const option of preLookupOptions) {
                                            if (resolvedRule[option] !== undefined) {
                                                const message = `${currentPath}[${subIndex}]: packageRules cannot combine both matchUpdateTypes and ${option}. Rule: ${JSON.stringify(packageRule)}`;
                                                errors.push({
                                                    topic: 'Configuration Error',
                                                    message,
                                                });
                                            }
                                        }
                                    }
                                }
                                else {
                                    errors.push({
                                        topic: 'Configuration Error',
                                        message: `${currentPath} must contain JSON objects`,
                                    });
                                }
                            }
                        }
                        if (key === 'regexManagers') {
                            const allowedKeys = [
                                'description',
                                'fileMatch',
                                'matchStrings',
                                'matchStringsStrategy',
                                'depNameTemplate',
                                'packageNameTemplate',
                                'datasourceTemplate',
                                'versioningTemplate',
                                'registryUrlTemplate',
                                'currentValueTemplate',
                                'extractVersionTemplate',
                                'autoReplaceStringTemplate',
                                'depTypeTemplate',
                            ];
                            // TODO: fix types #7154
                            for (const regexManager of val) {
                                if (Object.keys(regexManager).some((k) => !allowedKeys.includes(k))) {
                                    const disallowedKeys = Object.keys(regexManager).filter((k) => !allowedKeys.includes(k));
                                    errors.push({
                                        topic: 'Configuration Error',
                                        message: `Regex Manager contains disallowed fields: ${disallowedKeys.join(', ')}`,
                                    });
                                }
                                else if (is_1.default.nonEmptyArray(regexManager.fileMatch)) {
                                    if (is_1.default.nonEmptyArray(regexManager.matchStrings)) {
                                        let validRegex = false;
                                        for (const matchString of regexManager.matchStrings) {
                                            try {
                                                (0, regex_1.regEx)(matchString);
                                                validRegex = true;
                                            }
                                            catch (e) {
                                                errors.push({
                                                    topic: 'Configuration Error',
                                                    message: `Invalid regExp for ${currentPath}: \`${String(matchString)}\``,
                                                });
                                            }
                                        }
                                        if (validRegex) {
                                            const mandatoryFields = [
                                                'depName',
                                                'currentValue',
                                                'datasource',
                                            ];
                                            for (const field of mandatoryFields) {
                                                if (!regexManager[`${field}Template`] &&
                                                    !regexManager.matchStrings.some((matchString) => matchString.includes(`(?<${field}>`))) {
                                                    errors.push({
                                                        topic: 'Configuration Error',
                                                        message: `Regex Managers must contain ${field}Template configuration or regex group named ${field}`,
                                                    });
                                                }
                                            }
                                        }
                                    }
                                    else {
                                        errors.push({
                                            topic: 'Configuration Error',
                                            message: `Each Regex Manager must contain a non-empty matchStrings array`,
                                        });
                                    }
                                }
                                else {
                                    errors.push({
                                        topic: 'Configuration Error',
                                        message: `Each Regex Manager must contain a non-empty fileMatch array`,
                                    });
                                }
                            }
                        }
                        if (key === 'matchPackagePatterns' ||
                            key === 'excludePackagePatterns') {
                            for (const pattern of val) {
                                if (pattern !== '*') {
                                    try {
                                        (0, regex_1.regEx)(pattern);
                                    }
                                    catch (e) {
                                        errors.push({
                                            topic: 'Configuration Error',
                                            message: `Invalid regExp for ${currentPath}: \`${pattern}\``,
                                        });
                                    }
                                }
                            }
                        }
                        if (key === 'fileMatch') {
                            for (const fileMatch of val) {
                                try {
                                    (0, regex_1.regEx)(fileMatch);
                                }
                                catch (e) {
                                    errors.push({
                                        topic: 'Configuration Error',
                                        message: `Invalid regExp for ${currentPath}: \`${fileMatch}\``,
                                    });
                                }
                            }
                        }
                        if ((selectors.includes(key) || key === 'matchCurrentVersion') &&
                            // TODO: can be undefined ? #7154
                            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                            !rulesRe.test(parentPath) && // Inside a packageRule
                            (parentPath || !isPreset) // top level in a preset
                        ) {
                            errors.push({
                                topic: 'Configuration Error',
                                message: `${currentPath}: ${key} should be inside a \`packageRule\` only`,
                            });
                        }
                    }
                    else {
                        errors.push({
                            topic: 'Configuration Error',
                            message: `Configuration option \`${currentPath}\` should be a list (Array)`,
                        });
                    }
                }
                else if (type === 'string') {
                    if (!is_1.default.string(val)) {
                        errors.push({
                            topic: 'Configuration Error',
                            message: `Configuration option \`${currentPath}\` should be a string`,
                        });
                    }
                }
                else if (type === 'object' &&
                    currentPath !== 'compatibility' &&
                    currentPath !== 'constraints' &&
                    currentPath !== 'force.constraints') {
                    if (is_1.default.plainObject(val)) {
                        if (key === 'aliases') {
                            const res = validateAliasObject(val);
                            if (res !== true) {
                                errors.push({
                                    topic: 'Configuration Error',
                                    message: `Invalid \`${currentPath}.${key}.${res}\` configuration: value is not a url`,
                                });
                            }
                        }
                        else if (['customEnvVariables', 'migratePresets', 'secrets'].includes(key)) {
                            const res = validatePlainObject(val);
                            if (res !== true) {
                                errors.push({
                                    topic: 'Configuration Error',
                                    message: `Invalid \`${currentPath}.${key}.${res}\` configuration: value is not a string`,
                                });
                            }
                        }
                        else {
                            const ignoredObjects = options
                                .filter((option) => option.freeChoice)
                                .map((option) => option.name);
                            if (!ignoredObjects.includes(key)) {
                                const subValidation = await validateConfig(val, isPreset, currentPath);
                                warnings = warnings.concat(subValidation.warnings);
                                errors = errors.concat(subValidation.errors);
                            }
                        }
                    }
                    else {
                        errors.push({
                            topic: 'Configuration Error',
                            message: `Configuration option \`${currentPath}\` should be a json object`,
                        });
                    }
                }
            }
        }
    }
    function sortAll(a, b) {
        // istanbul ignore else: currently never happen
        if (a.topic === b.topic) {
            return a.message > b.message ? 1 : -1;
        }
        // istanbul ignore next: currently never happen
        return a.topic > b.topic ? 1 : -1;
    }
    errors.sort(sortAll);
    warnings.sort(sortAll);
    return { errors, warnings };
}
exports.validateConfig = validateConfig;
//# sourceMappingURL=validation.js.map