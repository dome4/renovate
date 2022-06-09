"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateLockedDependency = void 0;
const parsers_1 = require("@yarnpkg/parsers");
const logger_1 = require("../../../../../../logger");
const npm_1 = require("../../../../../versioning/npm");
const get_locked_1 = require("./get-locked");
const replace_1 = require("./replace");
function updateLockedDependency(config) {
    const { depName, currentVersion, newVersion, lockFile, lockFileContent } = config;
    logger_1.logger.debug(`npm.updateLockedDependency: ${depName}@${currentVersion} -> ${newVersion} [${lockFile}]`);
    let yarnLock;
    try {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        yarnLock = (0, parsers_1.parseSyml)(lockFileContent);
    }
    catch (err) {
        logger_1.logger.warn({ err }, 'Failed to parse yarn files');
        return { status: 'update-failed' };
    }
    if ('__metadata' in yarnLock) {
        logger_1.logger.debug('Yarn 2+ unsupported');
        return { status: 'unsupported' };
    }
    try {
        const lockedDeps = (0, get_locked_1.getLockedDependencies)(yarnLock, depName, 
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        currentVersion);
        if (!lockedDeps.length) {
            const newLockedDeps = (0, get_locked_1.getLockedDependencies)(yarnLock, depName, newVersion);
            if (newLockedDeps.length) {
                logger_1.logger.debug(`${depName}@${currentVersion} not found in ${lockFile} but ${depName}@${newVersion} was - looks like it's already updated`);
                return { status: 'already-updated' };
            }
            logger_1.logger.debug(`${depName}@${currentVersion} not found in ${lockFile} - cannot update`);
            return { status: 'update-failed' };
        }
        logger_1.logger.debug(`Found matching dependencies with length ${lockedDeps.length}`);
        const updateLockedDeps = [];
        for (const lockedDep of lockedDeps) {
            if (npm_1.api.matches(newVersion, lockedDep.constraint)) {
                logger_1.logger.debug(`Dependency ${depName} can be updated from ${newVersion} to ${newVersion} in range ${lockedDep.constraint}`);
                updateLockedDeps.push({ ...lockedDep, newVersion });
                continue;
            }
            logger_1.logger.debug(`Dependency ${depName} cannot be updated from ${newVersion} to ${newVersion} in range ${lockedDep.constraint}`);
            return { status: 'update-failed' };
        }
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        let newLockFileContent = lockFileContent;
        for (const dependency of updateLockedDeps) {
            const { depName, constraint, newVersion } = dependency;
            newLockFileContent = (0, replace_1.replaceConstraintVersion)(newLockFileContent, depName, constraint, newVersion);
        }
        // istanbul ignore if: cannot test
        if (newLockFileContent === lockFileContent) {
            logger_1.logger.debug('Failed to make any changes to lock file');
            return { status: 'update-failed' };
        }
        return { status: 'updated', files: { [lockFile]: newLockFileContent } };
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.error({ err }, 'updateLockedDependency() error');
        return { status: 'update-failed' };
    }
}
exports.updateLockedDependency = updateLockedDependency;
//# sourceMappingURL=index.js.map