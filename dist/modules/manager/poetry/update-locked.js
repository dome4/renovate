"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateLockedDependency = void 0;
const logger_1 = require("../../../logger");
const locked_version_1 = require("./locked-version");
function updateLockedDependency(config) {
    const { depName, currentVersion, newVersion, lockFile, lockFileContent } = config;
    logger_1.logger.debug(`poetry.updateLockedDependency: ${depName}@${currentVersion} -> ${newVersion} [${lockFile}]`);
    const locked = (0, locked_version_1.extractLockFileEntries)(lockFileContent || '');
    if (depName && locked[depName] === newVersion) {
        return { status: 'already-updated' };
    }
    return { status: 'unsupported' };
}
exports.updateLockedDependency = updateLockedDependency;
//# sourceMappingURL=update-locked.js.map