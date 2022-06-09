"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyPackageRules = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const minimatch_1 = tslib_1.__importDefault(require("minimatch"));
const slugify_1 = tslib_1.__importDefault(require("slugify"));
const config_1 = require("../config");
const logger_1 = require("../logger");
const allVersioning = tslib_1.__importStar(require("../modules/versioning"));
const regex_1 = require("./regex");
function matchesRule(inputConfig, packageRule) {
    const { versioning, packageFile, lockFiles, depType, depTypes, depName, currentValue, currentVersion, lockedVersion, updateType, isBump, sourceUrl, language, baseBranch, manager, datasource, } = inputConfig;
    const unconstrainedValue = lockedVersion && is_1.default.undefined(currentValue);
    // Setting empty arrays simplifies our logic later
    const matchFiles = packageRule.matchFiles || [];
    const matchPaths = packageRule.matchPaths || [];
    const matchLanguages = packageRule.matchLanguages || [];
    const matchBaseBranches = packageRule.matchBaseBranches || [];
    const matchManagers = packageRule.matchManagers || [];
    const matchDatasources = packageRule.matchDatasources || [];
    const matchDepTypes = packageRule.matchDepTypes || [];
    const matchPackageNames = packageRule.matchPackageNames || [];
    let matchPackagePatterns = packageRule.matchPackagePatterns || [];
    const matchPackagePrefixes = packageRule.matchPackagePrefixes || [];
    const excludePackageNames = packageRule.excludePackageNames || [];
    const excludePackagePatterns = packageRule.excludePackagePatterns || [];
    const excludePackagePrefixes = packageRule.excludePackagePrefixes || [];
    const matchSourceUrlPrefixes = packageRule.matchSourceUrlPrefixes || [];
    const matchSourceUrls = packageRule.matchSourceUrls || [];
    const matchCurrentVersion = packageRule.matchCurrentVersion || null;
    const matchUpdateTypes = packageRule.matchUpdateTypes || [];
    let positiveMatch = false;
    // Massage a positive patterns patch if an exclude one is present
    if ((excludePackageNames.length ||
        excludePackagePatterns.length ||
        excludePackagePrefixes.length) &&
        !(matchPackageNames.length ||
            matchPackagePatterns.length ||
            matchPackagePrefixes.length)) {
        matchPackagePatterns = ['.*'];
    }
    if (matchFiles.length) {
        const isMatch = matchFiles.some((fileName) => packageFile === fileName ||
            (is_1.default.array(lockFiles) && lockFiles?.includes(fileName)));
        if (!isMatch) {
            return false;
        }
        positiveMatch = true;
    }
    if (matchPaths.length && packageFile) {
        const isMatch = matchPaths.some((rulePath) => packageFile.includes(rulePath) ||
            (0, minimatch_1.default)(packageFile, rulePath, { dot: true }));
        if (!isMatch) {
            return false;
        }
        positiveMatch = true;
    }
    if (matchDepTypes.length) {
        const isMatch = (depType && matchDepTypes.includes(depType)) ||
            depTypes?.some((dt) => matchDepTypes.includes(dt));
        if (!isMatch) {
            return false;
        }
        positiveMatch = true;
    }
    if (matchLanguages.length) {
        if (!language) {
            return false;
        }
        const isMatch = matchLanguages.includes(language);
        if (!isMatch) {
            return false;
        }
        positiveMatch = true;
    }
    if (matchBaseBranches.length) {
        if (!baseBranch) {
            return false;
        }
        const isMatch = matchBaseBranches.some((matchBaseBranch) => {
            const isAllowedPred = (0, regex_1.configRegexPredicate)(matchBaseBranch);
            if (isAllowedPred) {
                return isAllowedPred(baseBranch);
            }
            return matchBaseBranch === baseBranch;
        });
        if (!isMatch) {
            return false;
        }
        positiveMatch = true;
    }
    if (matchManagers.length) {
        if (!manager) {
            return false;
        }
        const isMatch = matchManagers.includes(manager);
        if (!isMatch) {
            return false;
        }
        positiveMatch = true;
    }
    if (matchDatasources.length) {
        if (!datasource) {
            return false;
        }
        const isMatch = matchDatasources.includes(datasource);
        if (!isMatch) {
            return false;
        }
        positiveMatch = true;
    }
    if (matchUpdateTypes.length) {
        const isMatch = (updateType && matchUpdateTypes.includes(updateType)) ||
            (isBump && matchUpdateTypes.includes('bump'));
        if (!isMatch) {
            return false;
        }
        positiveMatch = true;
    }
    if (matchPackageNames.length ||
        matchPackagePatterns.length ||
        matchPackagePrefixes.length) {
        if (!depName) {
            return false;
        }
        let isMatch = matchPackageNames.includes(depName);
        // name match is "or" so we check patterns if we didn't match names
        if (!isMatch) {
            for (const packagePattern of matchPackagePatterns) {
                const packageRegex = (0, regex_1.regEx)(packagePattern === '^*$' || packagePattern === '*'
                    ? '.*'
                    : packagePattern);
                if (packageRegex.test(depName)) {
                    logger_1.logger.trace(`${depName} matches against ${String(packageRegex)}`);
                    isMatch = true;
                }
            }
        }
        // prefix match is also "or"
        if (!isMatch && matchPackagePrefixes.length) {
            isMatch = matchPackagePrefixes.some((prefix) => depName.startsWith(prefix));
        }
        if (!isMatch) {
            return false;
        }
        positiveMatch = true;
    }
    if (excludePackageNames.length) {
        const isMatch = depName && excludePackageNames.includes(depName);
        if (isMatch) {
            return false;
        }
        positiveMatch = true;
    }
    if (depName && excludePackagePatterns.length) {
        let isMatch = false;
        for (const pattern of excludePackagePatterns) {
            const packageRegex = (0, regex_1.regEx)(pattern === '^*$' || pattern === '*' ? '.*' : pattern);
            if (packageRegex.test(depName)) {
                logger_1.logger.trace(`${depName} matches against ${String(packageRegex)}`);
                isMatch = true;
            }
        }
        if (isMatch) {
            return false;
        }
        positiveMatch = true;
    }
    if (depName && excludePackagePrefixes.length) {
        const isMatch = excludePackagePrefixes.some((prefix) => depName.startsWith(prefix));
        if (isMatch) {
            return false;
        }
        positiveMatch = true;
    }
    if (matchSourceUrlPrefixes.length) {
        const upperCaseSourceUrl = sourceUrl?.toUpperCase();
        const isMatch = matchSourceUrlPrefixes.some((prefix) => upperCaseSourceUrl?.startsWith(prefix.toUpperCase()));
        if (!isMatch) {
            return false;
        }
        positiveMatch = true;
    }
    if (matchSourceUrls.length) {
        const upperCaseSourceUrl = sourceUrl?.toUpperCase();
        const isMatch = matchSourceUrls.some((url) => upperCaseSourceUrl === url.toUpperCase());
        if (!isMatch) {
            return false;
        }
        positiveMatch = true;
    }
    if (matchCurrentVersion) {
        const version = allVersioning.get(versioning);
        const matchCurrentVersionStr = matchCurrentVersion.toString();
        const matchCurrentVersionPred = (0, regex_1.configRegexPredicate)(matchCurrentVersionStr);
        if (matchCurrentVersionPred) {
            if (!unconstrainedValue &&
                (!currentValue || !matchCurrentVersionPred(currentValue))) {
                return false;
            }
            positiveMatch = true;
        }
        else if (version.isVersion(matchCurrentVersionStr)) {
            let isMatch = false;
            try {
                isMatch =
                    unconstrainedValue ||
                        !!(currentValue &&
                            version.matches(matchCurrentVersionStr, currentValue));
            }
            catch (err) {
                // Do nothing
            }
            if (!isMatch) {
                return false;
            }
            positiveMatch = true;
        }
        else {
            const compareVersion = currentValue && version.isVersion(currentValue)
                ? currentValue // it's a version so we can match against it
                : lockedVersion || currentVersion; // need to match against this currentVersion, if available
            if (compareVersion) {
                // istanbul ignore next
                if (version.isVersion(compareVersion)) {
                    const isMatch = version.matches(compareVersion, matchCurrentVersion);
                    // istanbul ignore if
                    if (!isMatch) {
                        return false;
                    }
                    positiveMatch = true;
                }
                else {
                    return false;
                }
            }
            else {
                logger_1.logger.debug({ matchCurrentVersionStr, currentValue }, 'Could not find a version to compare');
                return false;
            }
        }
    }
    return positiveMatch;
}
function applyPackageRules(inputConfig) {
    let config = { ...inputConfig };
    const packageRules = config.packageRules || [];
    logger_1.logger.trace({ dependency: config.depName, packageRules }, `Checking against ${packageRules.length} packageRules`);
    packageRules.forEach((packageRule) => {
        // This rule is considered matched if there was at least one positive match and no negative matches
        if (matchesRule(config, packageRule)) {
            // Package rule config overrides any existing config
            const toApply = { ...packageRule };
            if (config.groupSlug && packageRule.groupName && !packageRule.groupSlug) {
                // Need to apply groupSlug otherwise the existing one will take precedence
                toApply.groupSlug = (0, slugify_1.default)(packageRule.groupName, {
                    lower: true,
                });
            }
            config = (0, config_1.mergeChildConfig)(config, toApply);
            delete config.matchPackageNames;
            delete config.matchPackagePatterns;
            delete config.matchPackagePrefixes;
            delete config.excludePackageNames;
            delete config.excludePackagePatterns;
            delete config.excludePackagePrefixes;
            delete config.matchDepTypes;
            delete config.matchCurrentVersion;
        }
    });
    return config;
}
exports.applyPackageRules = applyPackageRules;
//# sourceMappingURL=package-rules.js.map