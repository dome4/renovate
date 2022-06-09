"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findFirstParentVersion = void 0;
const logger_1 = require("../../../../../../logger");
const datasource_1 = require("../../../../../datasource");
const npm_1 = require("../../../../../versioning/npm");
/**
 * Finds the first stable version of parentName after parentStartingVersion which either:
 * - depends on targetDepName@targetVersion or a range which it satisfies, OR
 * - removes the dependency targetDepName altogether, OR
 * - depends on any version of targetDepName higher than targetVersion
 */
async function findFirstParentVersion(parentName, parentStartingVersion, targetDepName, targetVersion) {
    // istanbul ignore if
    if (!npm_1.api.isVersion(parentStartingVersion)) {
        logger_1.logger.debug('parentStartingVersion is not a version - cannot remediate');
        return null;
    }
    logger_1.logger.debug(`Finding first version of ${parentName} starting with ${parentStartingVersion} which supports >= ${targetDepName}@${targetVersion}`);
    try {
        let lookupConfig = {
            datasource: 'npm',
            depName: targetDepName,
        };
        const targetDep = await (0, datasource_1.getPkgReleases)(lookupConfig);
        // istanbul ignore if
        if (!targetDep) {
            logger_1.logger.warn({ targetDepName }, 'Could not look up target dependency for remediation');
            return null;
        }
        const targetVersions = targetDep.releases
            .map((release) => release.version)
            .filter((version) => npm_1.api.isVersion(version) &&
            npm_1.api.isStable(version) &&
            (version === targetVersion ||
                npm_1.api.isGreaterThan(version, targetVersion)));
        lookupConfig = {
            datasource: 'npm',
            depName: parentName,
        };
        const parentDep = await (0, datasource_1.getPkgReleases)(lookupConfig);
        // istanbul ignore if
        if (!parentDep) {
            logger_1.logger.info({ parentName }, 'Could not look up parent dependency for remediation');
            return null;
        }
        const parentVersions = parentDep.releases
            .map((release) => release.version)
            .filter((version) => npm_1.api.isVersion(version) &&
            npm_1.api.isStable(version) &&
            (version === parentStartingVersion ||
                npm_1.api.isGreaterThan(version, parentStartingVersion)))
            .sort((v1, v2) => npm_1.api.sortVersions(v1, v2));
        // iterate through parentVersions in sorted order
        for (const parentVersion of parentVersions) {
            const constraint = parentDep.releases.find((release) => release.version === parentVersion)?.dependencies?.[targetDepName];
            if (!constraint) {
                logger_1.logger.debug(`${targetDepName} has been removed from ${parentName}@${parentVersion}`);
                return parentVersion;
            }
            if (npm_1.api.matches(targetVersion, constraint)) {
                // could be version or range
                logger_1.logger.debug(`${targetDepName} needs ${parentName}@${parentVersion} which uses constraint "${constraint}" in order to update to ${targetVersion}`);
                return parentVersion;
            }
            if (npm_1.api.isVersion(constraint)) {
                if (npm_1.api.isGreaterThan(constraint, targetVersion)) {
                    // it's not the version we were after - the parent skipped to a higher version
                    logger_1.logger.debug(`${targetDepName} needs ${parentName}@${parentVersion} which uses version "${constraint}" in order to update to greater than ${targetVersion}`);
                    return parentVersion;
                }
            }
            else if (
            // check the range against all versions
            targetVersions.some((version) => npm_1.api.matches(version, constraint))) {
                // the constraint didn't match the version we wanted, but it matches one of the versions higher
                logger_1.logger.debug(`${targetDepName} needs ${parentName}@${parentVersion} which uses constraint "${constraint}" in order to update to greater than ${targetVersion}`);
                return parentVersion;
            }
        }
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.warn({ parentName, parentStartingVersion, targetDepName, targetVersion, err }, 'findFirstParentVersion error');
        return null;
    }
    logger_1.logger.debug(`Could not find a matching version`);
    return null;
}
exports.findFirstParentVersion = findFirstParentVersion;
//# sourceMappingURL=parent-version.js.map