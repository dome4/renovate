"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lookupUpdates = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const config_1 = require("../../../../config");
const error_messages_1 = require("../../../../constants/error-messages");
const logger_1 = require("../../../../logger");
const datasource_1 = require("../../../../modules/datasource");
const manager_1 = require("../../../../modules/manager");
const allVersioning = tslib_1.__importStar(require("../../../../modules/versioning"));
const external_host_error_1 = require("../../../../types/errors/external-host-error");
const clone_1 = require("../../../../util/clone");
const package_rules_1 = require("../../../../util/package-rules");
const regex_1 = require("../../../../util/regex");
const bucket_1 = require("./bucket");
const current_1 = require("./current");
const filter_1 = require("./filter");
const filter_checks_1 = require("./filter-checks");
const generate_1 = require("./generate");
const rollback_1 = require("./rollback");
async function lookupUpdates(inconfig) {
    let config = { ...inconfig };
    const { currentDigest, currentValue, datasource, depName, digestOneAndOnly, followTag, lockedVersion, packageFile, pinDigests, rollbackPrs, isVulnerabilityAlert, updatePinnedDependencies, } = config;
    const unconstrainedValue = lockedVersion && is_1.default.undefined(currentValue);
    const res = {
        updates: [],
        warnings: [],
    };
    try {
        logger_1.logger.trace({ dependency: depName, currentValue }, 'lookupUpdates');
        // Use the datasource's default versioning if none is configured
        config.versioning ?? (config.versioning = (0, datasource_1.getDefaultVersioning)(datasource));
        const versioning = allVersioning.get(config.versioning);
        res.versioning = config.versioning;
        // istanbul ignore if
        if (!(0, datasource_1.isGetPkgReleasesConfig)(config) ||
            !(0, datasource_1.getDatasourceList)().includes(datasource)) {
            res.skipReason = 'invalid-config';
            return res;
        }
        const isValid = is_1.default.string(currentValue) && versioning.isValid(currentValue);
        if (unconstrainedValue || isValid) {
            if (!updatePinnedDependencies &&
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                versioning.isSingleVersion(currentValue)) {
                res.skipReason = 'is-pinned';
                return res;
            }
            const dependency = (0, clone_1.clone)(await (0, datasource_1.getPkgReleases)(config));
            if (!dependency) {
                // If dependency lookup fails then warn and return
                const warning = {
                    topic: depName,
                    message: `Failed to look up dependency ${depName}`,
                };
                logger_1.logger.debug({ dependency: depName, packageFile }, warning.message);
                // TODO: return warnings in own field
                res.warnings.push(warning);
                return res;
            }
            if (dependency.deprecationMessage) {
                logger_1.logger.debug({ dependency: depName }, 'Found deprecationMessage');
                res.deprecationMessage = dependency.deprecationMessage;
            }
            res.sourceUrl = dependency?.sourceUrl;
            if (dependency.sourceDirectory) {
                res.sourceDirectory = dependency.sourceDirectory;
            }
            res.homepage = dependency.homepage;
            res.changelogUrl = dependency.changelogUrl;
            res.dependencyUrl = dependency?.dependencyUrl;
            const latestVersion = dependency.tags?.latest;
            // Filter out any results from datasource that don't comply with our versioning
            let allVersions = dependency.releases.filter((release) => versioning.isVersion(release.version));
            // istanbul ignore if
            if (allVersions.length === 0) {
                const message = `Found no results from datasource that look like a version`;
                logger_1.logger.debug({ dependency: depName, result: dependency }, message);
                if (!currentDigest) {
                    return res;
                }
            }
            // Reapply package rules in case we missed something from sourceUrl
            config = (0, package_rules_1.applyPackageRules)({ ...config, sourceUrl: res.sourceUrl });
            if (followTag) {
                const taggedVersion = dependency.tags?.[followTag];
                if (!taggedVersion) {
                    res.warnings.push({
                        topic: depName,
                        message: `Can't find version with tag ${followTag} for ${depName}`,
                    });
                    return res;
                }
                allVersions = allVersions.filter((v) => v.version === taggedVersion ||
                    (v.version === currentValue &&
                        versioning.isGreaterThan(taggedVersion, currentValue)));
            }
            // Check that existing constraint can be satisfied
            const allSatisfyingVersions = allVersions.filter((v) => 
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            unconstrainedValue || versioning.matches(v.version, currentValue));
            if (rollbackPrs && !allSatisfyingVersions.length) {
                const rollback = (0, rollback_1.getRollbackUpdate)(config, allVersions, versioning);
                // istanbul ignore if
                if (!rollback) {
                    res.warnings.push({
                        topic: depName,
                        message: `Can't find version matching ${currentValue} for ${depName}`,
                    });
                    return res;
                }
                res.updates.push(rollback);
            }
            let rangeStrategy = (0, manager_1.getRangeStrategy)(config);
            if (dependency.replacementName && dependency.replacementVersion) {
                res.updates.push({
                    updateType: 'replacement',
                    newName: dependency.replacementName,
                    newValue: versioning.getNewValue({
                        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                        currentValue: currentValue,
                        newVersion: dependency.replacementVersion,
                        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                        rangeStrategy: rangeStrategy,
                    }),
                });
            }
            // istanbul ignore next
            if (isVulnerabilityAlert &&
                rangeStrategy === 'update-lockfile' &&
                !lockedVersion) {
                rangeStrategy = 'bump';
            }
            const nonDeprecatedVersions = dependency.releases
                .filter((release) => !release.isDeprecated)
                .map((release) => release.version);
            let currentVersion;
            if (rangeStrategy === 'update-lockfile') {
                currentVersion = lockedVersion;
            }
            currentVersion ?? (currentVersion = (0, current_1.getCurrentVersion)(
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            currentValue, 
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            lockedVersion, versioning, 
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            rangeStrategy, 
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            latestVersion, nonDeprecatedVersions) ||
                (0, current_1.getCurrentVersion)(
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                currentValue, 
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                lockedVersion, versioning, 
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                rangeStrategy, 
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                latestVersion, allVersions.map((v) => v.version)));
            // istanbul ignore if
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            if (!currentVersion && lockedVersion) {
                return res;
            }
            res.currentVersion = currentVersion;
            if (currentValue &&
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                currentVersion &&
                rangeStrategy === 'pin' &&
                !versioning.isSingleVersion(currentValue)) {
                res.updates.push({
                    updateType: 'pin',
                    isPin: true,
                    newValue: versioning.getNewValue({
                        currentValue,
                        rangeStrategy,
                        currentVersion,
                        newVersion: currentVersion,
                    }),
                    newMajor: versioning.getMajor(currentVersion),
                });
            }
            // istanbul ignore if
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            if (!versioning.isVersion(currentVersion)) {
                res.skipReason = 'invalid-version';
                return res;
            }
            // Filter latest, unstable, etc
            let filteredReleases = (0, filter_1.filterVersions)(config, 
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            currentVersion, 
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            latestVersion, allVersions, versioning).filter((v) => 
            // Leave only compatible versions
            unconstrainedValue || versioning.isCompatible(v.version, currentValue));
            if (isVulnerabilityAlert) {
                filteredReleases = filteredReleases.slice(0, 1);
            }
            const buckets = {};
            for (const release of filteredReleases) {
                const bucket = (0, bucket_1.getBucket)(config, 
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                currentVersion, release.version, versioning);
                if (is_1.default.string(bucket)) {
                    if (buckets[bucket]) {
                        buckets[bucket].push(release);
                    }
                    else {
                        buckets[bucket] = [release];
                    }
                }
            }
            const depResultConfig = (0, config_1.mergeChildConfig)(config, res);
            for (const [bucket, releases] of Object.entries(buckets)) {
                const sortedReleases = releases.sort((r1, r2) => versioning.sortVersions(r1.version, r2.version));
                const { release, pendingChecks, pendingReleases } = await (0, filter_checks_1.filterInternalChecks)(depResultConfig, versioning, bucket, sortedReleases);
                // istanbul ignore next
                if (!release) {
                    return res;
                }
                const newVersion = release.version;
                const update = (0, generate_1.generateUpdate)(config, versioning, 
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                rangeStrategy, 
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                lockedVersion || currentVersion, bucket, release);
                if (pendingChecks) {
                    update.pendingChecks = pendingChecks;
                }
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                if (pendingReleases.length) {
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                    update.pendingVersions = pendingReleases.map((r) => r.version);
                }
                if (!update.newValue || update.newValue === currentValue) {
                    if (!lockedVersion) {
                        continue;
                    }
                    // istanbul ignore if
                    if (rangeStrategy === 'bump') {
                        logger_1.logger.trace({ depName, currentValue, lockedVersion, newVersion }, 'Skipping bump because newValue is the same');
                        continue;
                    }
                    res.isSingleVersion = true;
                }
                res.isSingleVersion =
                    res.isSingleVersion || !!versioning.isSingleVersion(update.newValue);
                res.updates.push(update);
            }
        }
        else if (currentValue) {
            logger_1.logger.debug(`Dependency ${depName} has unsupported value ${currentValue}`);
            if (!pinDigests && !currentDigest) {
                res.skipReason = 'invalid-value';
            }
            else {
                delete res.skipReason;
            }
        }
        else {
            res.skipReason = 'invalid-value';
        }
        // Record if the dep is fixed to a version
        if (lockedVersion) {
            res.currentVersion = lockedVersion;
            res.fixedVersion = lockedVersion;
        }
        else if (currentValue && versioning.isSingleVersion(currentValue)) {
            res.fixedVersion = currentValue.replace((0, regex_1.regEx)(/^=+/), '');
        }
        // Add digests if necessary
        if ((0, datasource_1.supportsDigests)(config.datasource)) {
            if (currentDigest) {
                if (!digestOneAndOnly || !res.updates.length) {
                    // digest update
                    res.updates.push({
                        updateType: 'digest',
                        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                        newValue: currentValue,
                    });
                }
            }
            else if (pinDigests) {
                // Create a pin only if one doesn't already exists
                if (!res.updates.some((update) => update.updateType === 'pin')) {
                    // pin digest
                    res.updates.push({
                        isPinDigest: true,
                        updateType: 'pinDigest',
                        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                        newValue: currentValue,
                    });
                }
            }
            if (versioning.valueToVersion) {
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                res.currentVersion = versioning.valueToVersion(res.currentVersion);
                for (const update of res.updates || []) {
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                    update.newVersion = versioning.valueToVersion(update.newVersion);
                }
            }
            // update digest for all
            for (const update of res.updates) {
                if (pinDigests || currentDigest) {
                    update.newDigest =
                        update.newDigest || (await (0, datasource_1.getDigest)(config, update.newValue));
                }
            }
        }
        if (res.updates.length) {
            delete res.skipReason;
        }
        // Strip out any non-changed ones
        res.updates = res.updates
            .filter((update) => update.newDigest !== null)
            .filter((update) => update.newValue !== currentValue ||
            update.isLockfileUpdate ||
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            (update.newDigest && !update.newDigest.startsWith(currentDigest)));
        // If range strategy specified in config is 'in-range-only', also strip out updates where currentValue !== newValue
        if (config.rangeStrategy === 'in-range-only') {
            res.updates = res.updates.filter((update) => update.newValue === currentValue);
        }
    }
    catch (err) /* istanbul ignore next */ {
        if (err instanceof external_host_error_1.ExternalHostError || err.message === error_messages_1.CONFIG_VALIDATION) {
            throw err;
        }
        logger_1.logger.error({
            currentDigest,
            currentValue,
            datasource,
            depName,
            digestOneAndOnly,
            followTag,
            lockedVersion,
            packageFile,
            pinDigests,
            rollbackPrs,
            isVulnerabilityAlert,
            updatePinnedDependencies,
            unconstrainedValue,
            err,
        }, 'lookupUpdates error');
        res.skipReason = 'internal-error';
    }
    return res;
}
exports.lookupUpdates = lookupUpdates;
//# sourceMappingURL=index.js.map