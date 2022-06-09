"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNpmLock = void 0;
const logger_1 = require("../../../../logger");
const fs_1 = require("../../../../util/fs");
async function getNpmLock(filePath) {
    const lockRaw = await (0, fs_1.readLocalFile)(filePath, 'utf8');
    try {
        const lockParsed = JSON.parse(lockRaw);
        const lockedVersions = {};
        for (const [entry, val] of Object.entries((lockParsed.dependencies || {}))) {
            logger_1.logger.trace({ entry, version: val.version });
            lockedVersions[entry] = val.version;
        }
        return { lockedVersions, lockfileVersion: lockParsed.lockfileVersion };
    }
    catch (err) {
        logger_1.logger.debug({ filePath, err }, 'Warning: Exception parsing npm lock file');
        return { lockedVersions: {} };
    }
}
exports.getNpmLock = getNpmLock;
//# sourceMappingURL=npm.js.map