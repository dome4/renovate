"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInRangeReleases = void 0;
const logger_1 = require("../../../../../logger");
const datasource_1 = require("../../../../../modules/datasource");
const versioning_1 = require("../../../../../modules/versioning");
function matchesMMP(version, v1, v2) {
    return (version.getMajor(v1) === version.getMajor(v2) &&
        version.getMinor(v1) === version.getMinor(v2) &&
        version.getPatch(v1) === version.getPatch(v2));
}
function matchesUnstable(version, v1, v2) {
    return !version.isStable(v1) && matchesMMP(version, v1, v2);
}
async function getInRangeReleases(config) {
    const { versioning, currentVersion, newVersion, depName, datasource } = config;
    // istanbul ignore if
    if (!(0, datasource_1.isGetPkgReleasesConfig)(config)) {
        return null;
    }
    try {
        const pkgReleases = (await (0, datasource_1.getPkgReleases)(config)).releases;
        const version = (0, versioning_1.get)(versioning);
        const releases = pkgReleases
            .filter((release) => version.isCompatible(release.version, currentVersion))
            .filter((release) => version.equals(release.version, currentVersion) ||
            version.isGreaterThan(release.version, currentVersion))
            .filter((release) => !version.isGreaterThan(release.version, newVersion))
            .filter((release) => version.isStable(release.version) ||
            matchesUnstable(version, currentVersion, release.version) ||
            matchesUnstable(version, newVersion, release.version));
        if (version.valueToVersion) {
            for (const release of releases || []) {
                release.version = version.valueToVersion(release.version);
            }
        }
        return releases;
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.debug({ err }, 'getInRangeReleases err');
        logger_1.logger.debug({ datasource, depName }, 'Error getting releases');
        return null;
    }
}
exports.getInRangeReleases = getInRangeReleases;
//# sourceMappingURL=releases.js.map