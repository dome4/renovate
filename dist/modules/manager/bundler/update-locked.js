"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateLockedDependency = void 0;
const logger_1 = require("../../../logger");
const locked_version_1 = require("./locked-version");
// TODO: fix coverage after strict null checks finished
function updateLockedDependency(config) {
    const { depName, currentVersion, newVersion, lockFile, lockFileContent } = config;
    logger_1.logger.debug(`bundler.updateLockedDependency: ${depName}@${currentVersion} -> ${newVersion} [${lockFile}]`);
    try {
        const locked = (0, locked_version_1.extractLockFileEntries)(lockFileContent ?? /* istanbul ignore next: should never happen */ '');
        if (locked.get(depName ?? /* istanbul ignore next: should never happen */ '') === newVersion) {
            return { status: 'already-updated' };
        }
        return { status: 'unsupported' };
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.debug({ err }, 'bundler.updateLockedDependency() error');
        return { status: 'update-failed' };
    }
}
exports.updateLockedDependency = updateLockedDependency;
//# sourceMappingURL=update-locked.js.map