"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateUpdate = void 0;
const logger_1 = require("../../../../logger");
const update_type_1 = require("./update-type");
function generateUpdate(config, versioning, rangeStrategy, currentVersion, bucket, release) {
    const newVersion = release.version;
    const update = {
        bucket,
        newVersion,
        newValue: null,
    };
    // istanbul ignore if
    if (release.checksumUrl !== undefined) {
        update.checksumUrl = release.checksumUrl;
    }
    // istanbul ignore if
    if (release.downloadUrl !== undefined) {
        update.downloadUrl = release.downloadUrl;
    }
    // istanbul ignore if
    if (release.newDigest !== undefined) {
        update.newDigest = release.newDigest;
    }
    // istanbul ignore if
    if (release.releaseTimestamp !== undefined) {
        update.releaseTimestamp = release.releaseTimestamp;
    }
    const { currentValue } = config;
    if (currentValue) {
        try {
            update.newValue = versioning.getNewValue({
                currentValue,
                rangeStrategy,
                currentVersion,
                newVersion,
            });
        }
        catch (err) /* istanbul ignore next */ {
            logger_1.logger.warn({ err, currentValue, rangeStrategy, currentVersion, newVersion }, 'getNewValue error');
            update.newValue = currentValue;
        }
    }
    else {
        update.newValue = currentValue;
    }
    update.newMajor = versioning.getMajor(newVersion);
    update.newMinor = versioning.getMinor(newVersion);
    // istanbul ignore if
    if (!update.updateType && !currentVersion) {
        logger_1.logger.debug({ update }, 'Update has no currentVersion');
        update.newValue = currentValue;
        return update;
    }
    update.updateType =
        update.updateType ||
            (0, update_type_1.getUpdateType)(config, versioning, currentVersion, newVersion);
    if (!versioning.isVersion(update.newValue)) {
        update.isRange = true;
    }
    if (rangeStrategy === 'update-lockfile' && currentValue === update.newValue) {
        update.isLockfileUpdate = true;
    }
    if (rangeStrategy === 'bump' &&
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        versioning.matches(newVersion, currentValue)) {
        update.isBump = true;
    }
    return update;
}
exports.generateUpdate = generateUpdate;
//# sourceMappingURL=generate.js.map