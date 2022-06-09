"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateLockedDependency = void 0;
const logger_1 = require("../../../logger");
const composer_1 = require("../../versioning/composer");
function updateLockedDependency(config) {
    const { depName, currentVersion, newVersion, lockFile, lockFileContent } = config;
    logger_1.logger.debug(`composer.updateLockedDependency: ${depName}@${currentVersion} -> ${newVersion} [${lockFile}]`);
    try {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        const locked = JSON.parse(lockFileContent);
        if (locked.packages?.find((entry) => entry.name === depName &&
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            composer_1.api.equals(entry.version || '', newVersion))) {
            return { status: 'already-updated' };
        }
        return { status: 'unsupported' };
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.debug({ err }, 'composer.updateLockedDependency() error');
        return { status: 'update-failed' };
    }
}
exports.updateLockedDependency = updateLockedDependency;
//# sourceMappingURL=update-locked.js.map