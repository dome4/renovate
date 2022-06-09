"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRollbackUpdate = void 0;
const logger_1 = require("../../../../logger");
function getRollbackUpdate(config, versions, version) {
    const { packageFile, versioning, depName, currentValue } = config;
    // istanbul ignore if
    if (!('isLessThanRange' in version)) {
        logger_1.logger.debug({ versioning }, 'Current versioning does not support isLessThanRange()');
        return null;
    }
    const lessThanVersions = versions.filter((v) => 
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    version.isLessThanRange(v.version, currentValue));
    // istanbul ignore if
    if (!lessThanVersions.length) {
        logger_1.logger.debug({ packageFile, depName, currentValue }, 'Missing version has nothing to roll back to');
        return null;
    }
    logger_1.logger.debug({ packageFile, depName, currentValue }, `Current version not found - rolling back`);
    logger_1.logger.debug({ dependency: depName, versions }, 'Versions found before rolling back');
    lessThanVersions.sort((a, b) => version.sortVersions(a.version, b.version));
    let newVersion;
    if (currentValue && version.isStable(currentValue)) {
        newVersion = lessThanVersions
            .filter((v) => version.isStable(v.version))
            .pop()?.version;
    }
    if (!newVersion) {
        newVersion = lessThanVersions.pop()?.version;
    }
    // istanbul ignore if
    if (!newVersion) {
        logger_1.logger.debug('No newVersion to roll back to');
        return null;
    }
    const newValue = version.getNewValue({
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        currentValue: currentValue,
        rangeStrategy: 'replace',
        newVersion,
    });
    return {
        bucket: 'rollback',
        newMajor: version.getMajor(newVersion),
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        newValue: newValue,
        newVersion,
        updateType: 'rollback',
    };
}
exports.getRollbackUpdate = getRollbackUpdate;
//# sourceMappingURL=rollback.js.map