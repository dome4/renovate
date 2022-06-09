"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateConfig = exports.fixShortHours = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const dequal_1 = require("dequal");
const logger_1 = require("../logger");
const clone_1 = require("../util/clone");
const regex_1 = require("../util/regex");
const migrations_1 = require("./migrations");
const options_1 = require("./options");
const utils_1 = require("./utils");
const options = (0, options_1.getOptions)();
function fixShortHours(input) {
    return input.replace((0, regex_1.regEx)(/( \d?\d)((a|p)m)/g), '$1:00$2');
}
exports.fixShortHours = fixShortHours;
let optionTypes;
// Returns a migrated config
function migrateConfig(config) {
    try {
        if (!optionTypes) {
            optionTypes = {};
            options.forEach((option) => {
                optionTypes[option.name] = option.type;
            });
        }
        const newConfig = migrations_1.MigrationsService.run(config);
        const migratedConfig = (0, clone_1.clone)(newConfig);
        const depTypes = [
            'dependencies',
            'devDependencies',
            'engines',
            'optionalDependencies',
            'peerDependencies',
        ];
        for (const [key, val] of Object.entries(newConfig)) {
            if (key.startsWith('masterIssue')) {
                const newKey = key.replace('masterIssue', 'dependencyDashboard');
                migratedConfig[newKey] = val;
                if (optionTypes[newKey] === 'boolean' && val === 'true') {
                    migratedConfig[newKey] = true;
                }
                delete migratedConfig[key];
            }
            else if (key === 'packageFiles' && is_1.default.array(val)) {
                const fileList = [];
                for (const packageFile of val) {
                    if (is_1.default.object(packageFile) && !is_1.default.array(packageFile)) {
                        fileList.push(packageFile.packageFile);
                        if (Object.keys(packageFile).length > 1) {
                            migratedConfig.packageRules = is_1.default.array(migratedConfig.packageRules)
                                ? migratedConfig.packageRules
                                : [];
                            const payload = migrateConfig(packageFile).migratedConfig;
                            for (const subrule of payload.packageRules || []) {
                                subrule.paths = [packageFile.packageFile];
                                migratedConfig.packageRules.push(subrule);
                            }
                            delete payload.packageFile;
                            delete payload.packageRules;
                            if (Object.keys(payload).length) {
                                migratedConfig.packageRules.push({
                                    ...payload,
                                    paths: [packageFile.packageFile],
                                });
                            }
                        }
                    }
                    else {
                        fileList.push(packageFile);
                    }
                }
                migratedConfig.includePaths = fileList;
                delete migratedConfig.packageFiles;
            }
            else if (depTypes.includes(key)) {
                migratedConfig.packageRules = is_1.default.array(migratedConfig.packageRules)
                    ? migratedConfig.packageRules
                    : [];
                const depTypePackageRule = migrateConfig(val).migratedConfig;
                depTypePackageRule.depTypeList = [key];
                delete depTypePackageRule.packageRules;
                migratedConfig.packageRules.push(depTypePackageRule);
                delete migratedConfig[key];
            }
            else if (is_1.default.string(val) && val.includes('{{baseDir}}')) {
                migratedConfig[key] = val.replace((0, regex_1.regEx)(/{{baseDir}}/g), '{{packageFileDir}}');
            }
            else if (is_1.default.string(val) && val.includes('{{lookupName}}')) {
                migratedConfig[key] = val.replace((0, regex_1.regEx)(/{{lookupName}}/g), '{{packageName}}');
            }
            else if (is_1.default.string(val) && val.includes('{{depNameShort}}')) {
                migratedConfig[key] = val.replace((0, regex_1.regEx)(/{{depNameShort}}/g), '{{depName}}');
            }
            else if (key === 'semanticPrefix' && is_1.default.string(val)) {
                delete migratedConfig.semanticPrefix;
                let [text] = val.split(':'); // TODO: fixme
                text = text.split('(');
                [migratedConfig.semanticCommitType] = text;
                if (text.length > 1) {
                    [migratedConfig.semanticCommitScope] = text[1].split(')');
                }
                else {
                    migratedConfig.semanticCommitScope = null;
                }
            }
            else if (is_1.default.string(val) && val.startsWith('{{semanticPrefix}}')) {
                migratedConfig[key] = val.replace('{{semanticPrefix}}', '{{#if semanticCommitType}}{{semanticCommitType}}{{#if semanticCommitScope}}({{semanticCommitScope}}){{/if}}: {{/if}}');
            }
            else if (key === 'depTypes' && is_1.default.array(val)) {
                val.forEach((depType) => {
                    if (is_1.default.object(depType) && !is_1.default.array(depType)) {
                        const depTypeName = depType.depType;
                        if (depTypeName) {
                            migratedConfig.packageRules = is_1.default.array(migratedConfig.packageRules)
                                ? migratedConfig.packageRules
                                : [];
                            const newPackageRule = migrateConfig(depType).migratedConfig;
                            delete newPackageRule.depType;
                            newPackageRule.depTypeList = [depTypeName];
                            migratedConfig.packageRules.push(newPackageRule);
                        }
                    }
                });
                delete migratedConfig.depTypes;
            }
            else if (optionTypes[key] === 'object' && is_1.default.boolean(val)) {
                migratedConfig[key] = { enabled: val };
            }
            else if (optionTypes[key] === 'boolean') {
                if (val === 'true') {
                    migratedConfig[key] = true;
                }
                else if (val === 'false') {
                    migratedConfig[key] = false;
                }
            }
            else if (optionTypes[key] === 'string' &&
                is_1.default.array(val) &&
                val.length === 1) {
                migratedConfig[key] = String(val[0]);
            }
            else if (key === 'node' && val.enabled === true) {
                // validated non-null
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                delete migratedConfig.node.enabled;
                migratedConfig.travis = migratedConfig.travis || {};
                migratedConfig.travis.enabled = true;
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                if (Object.keys(migratedConfig.node).length) {
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                    const subMigrate = migrateConfig(migratedConfig.node);
                    migratedConfig.node = subMigrate.migratedConfig;
                }
                else {
                    delete migratedConfig.node;
                }
            }
            else if (is_1.default.array(val)) {
                if (is_1.default.array(migratedConfig?.[key])) {
                    const newArray = [];
                    for (const item of migratedConfig[key]) {
                        if (is_1.default.object(item) && !is_1.default.array(item)) {
                            const arrMigrate = migrateConfig(item);
                            newArray.push(arrMigrate.migratedConfig);
                        }
                        else {
                            newArray.push(item);
                        }
                    }
                    migratedConfig[key] = newArray;
                }
            }
            else if (is_1.default.object(val)) {
                const subMigrate = migrateConfig(migratedConfig[key]);
                if (subMigrate.isMigrated) {
                    migratedConfig[key] = subMigrate.migratedConfig;
                }
            }
            const migratedTemplates = {
                fromVersion: 'currentVersion',
                newValueMajor: 'newMajor',
                newValueMinor: 'newMinor',
                newVersionMajor: 'newMajor',
                newVersionMinor: 'newMinor',
                toVersion: 'newVersion',
            };
            if (is_1.default.string(migratedConfig[key])) {
                for (const [from, to] of Object.entries(migratedTemplates)) {
                    migratedConfig[key] = migratedConfig[key].replace((0, regex_1.regEx)(from, 'g'), to);
                }
            }
        }
        if (is_1.default.array(migratedConfig.packageRules)) {
            const renameMap = {
                paths: 'matchPaths',
                languages: 'matchLanguages',
                baseBranchList: 'matchBaseBranches',
                managers: 'matchManagers',
                datasources: 'matchDatasources',
                depTypeList: 'matchDepTypes',
                packageNames: 'matchPackageNames',
                packagePatterns: 'matchPackagePatterns',
                sourceUrlPrefixes: 'matchSourceUrlPrefixes',
                updateTypes: 'matchUpdateTypes',
            };
            for (const packageRule of migratedConfig.packageRules) {
                for (const [oldKey, ruleVal] of Object.entries(packageRule)) {
                    const newKey = renameMap[oldKey];
                    if (newKey) {
                        // TODO: fix types #7154
                        packageRule[newKey] = ruleVal;
                        delete packageRule[oldKey];
                    }
                }
            }
        }
        // Migrate nested packageRules
        if (is_1.default.nonEmptyArray(migratedConfig.packageRules)) {
            const existingRules = migratedConfig.packageRules;
            migratedConfig.packageRules = [];
            for (const packageRule of existingRules) {
                if (is_1.default.array(packageRule.packageRules)) {
                    logger_1.logger.debug('Flattening nested packageRules');
                    // merge each subrule and add to the parent list
                    for (const subrule of packageRule.packageRules) {
                        // TODO: fix types #7154
                        const combinedRule = (0, utils_1.mergeChildConfig)(packageRule, subrule);
                        delete combinedRule.packageRules;
                        migratedConfig.packageRules.push(combinedRule);
                    }
                }
                else {
                    migratedConfig.packageRules.push(packageRule);
                }
            }
        }
        if (is_1.default.nonEmptyArray(migratedConfig.matchManagers)) {
            if (migratedConfig.matchManagers.includes('gradle-lite')) {
                if (!migratedConfig.matchManagers.includes('gradle')) {
                    migratedConfig.matchManagers.push('gradle');
                }
                migratedConfig.matchManagers = migratedConfig.matchManagers.filter((manager) => manager !== 'gradle-lite');
            }
        }
        if (is_1.default.nonEmptyObject(migratedConfig['gradle-lite'])) {
            migratedConfig.gradle = (0, utils_1.mergeChildConfig)(migratedConfig.gradle || {}, migratedConfig['gradle-lite']);
        }
        delete migratedConfig['gradle-lite'];
        const isMigrated = !(0, dequal_1.dequal)(config, migratedConfig);
        if (isMigrated) {
            // recursive call in case any migrated configs need further migrating
            return {
                isMigrated,
                migratedConfig: migrateConfig(migratedConfig).migratedConfig,
            };
        }
        return { isMigrated, migratedConfig };
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.debug({ config, err }, 'migrateConfig() error');
        throw err;
    }
}
exports.migrateConfig = migrateConfig;
//# sourceMappingURL=migration.js.map