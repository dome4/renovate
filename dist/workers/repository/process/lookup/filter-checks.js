"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterInternalChecks = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const config_1 = require("../../../../config");
const logger_1 = require("../../../../logger");
const date_1 = require("../../../../util/date");
const merge_confidence_1 = require("../../../../util/merge-confidence");
const package_rules_1 = require("../../../../util/package-rules");
const update_type_1 = require("./update-type");
async function filterInternalChecks(config, versioning, bucket, sortedReleases) {
    const { currentVersion, datasource, depName, internalChecksFilter } = config;
    let release = undefined;
    let pendingChecks = false;
    let pendingReleases = [];
    if (internalChecksFilter === 'none') {
        // Don't care if stabilityDays or minimumConfidence are unmet
        release = sortedReleases.pop();
    }
    else {
        // iterate through releases from highest to lowest, looking for the first which will pass checks if present
        for (const candidateRelease of sortedReleases.reverse()) {
            // merge the release data into dependency config
            let releaseConfig = (0, config_1.mergeChildConfig)(config, candidateRelease);
            // calculate updateType and then apply it
            releaseConfig.updateType = (0, update_type_1.getUpdateType)(releaseConfig, versioning, 
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            currentVersion, candidateRelease.version);
            releaseConfig = (0, config_1.mergeChildConfig)(releaseConfig, releaseConfig[releaseConfig.updateType]);
            // Apply packageRules in case any apply to updateType
            releaseConfig = (0, package_rules_1.applyPackageRules)(releaseConfig);
            // Now check for a stabilityDays config
            const { minimumConfidence, stabilityDays, releaseTimestamp, version: newVersion, updateType, } = releaseConfig;
            if (is_1.default.integer(stabilityDays) && releaseTimestamp) {
                if ((0, date_1.getElapsedDays)(releaseTimestamp) < stabilityDays) {
                    // Skip it if it doesn't pass checks
                    logger_1.logger.debug({ depName, check: 'stabilityDays' }, `Release ${candidateRelease.version} is pending status checks`);
                    pendingReleases.unshift(candidateRelease);
                    continue;
                }
            }
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            if ((0, merge_confidence_1.isActiveConfidenceLevel)(minimumConfidence)) {
                const confidenceLevel = await (0, merge_confidence_1.getMergeConfidenceLevel)(
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                datasource, 
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                depName, 
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                currentVersion, newVersion, 
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                updateType);
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                if (!(0, merge_confidence_1.satisfiesConfidenceLevel)(confidenceLevel, minimumConfidence)) {
                    logger_1.logger.debug({ depName, check: 'minimumConfidence' }, `Release ${candidateRelease.version} is pending status checks`);
                    pendingReleases.unshift(candidateRelease);
                    continue;
                }
            }
            // If we get to here, then the release is OK and we can stop iterating
            release = candidateRelease;
            break;
        }
        if (!release) {
            if (pendingReleases.length) {
                // If all releases were pending then just take the highest
                logger_1.logger.debug({ depName, bucket }, 'All releases are pending - using latest');
                release = pendingReleases.pop();
                // None are pending anymore because we took the latest, so empty the array
                pendingReleases = [];
                if (internalChecksFilter === 'strict') {
                    pendingChecks = true;
                }
            }
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    return { release: release, pendingChecks, pendingReleases };
}
exports.filterInternalChecks = filterInternalChecks;
//# sourceMappingURL=filter-checks.js.map