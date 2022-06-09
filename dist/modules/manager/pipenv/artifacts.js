"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateArtifacts = void 0;
const shlex_1 = require("shlex");
const error_messages_1 = require("../../../constants/error-messages");
const logger_1 = require("../../../logger");
const exec_1 = require("../../../util/exec");
const fs_1 = require("../../../util/fs");
const git_1 = require("../../../util/git");
function getPythonConstraint(existingLockFileContent, config) {
    const { constraints = {} } = config;
    const { python } = constraints;
    if (python) {
        logger_1.logger.debug('Using python constraint from config');
        return python;
    }
    try {
        const pipfileLock = JSON.parse(existingLockFileContent);
        if (pipfileLock?._meta?.requires?.python_version) {
            const pythonVersion = pipfileLock._meta.requires.python_version;
            return `== ${pythonVersion}.*`;
        }
        if (pipfileLock?._meta?.requires?.python_full_version) {
            const pythonFullVersion = pipfileLock._meta.requires.python_full_version;
            return `== ${pythonFullVersion}`;
        }
    }
    catch (err) {
        // Do nothing
    }
    return undefined;
}
function getPipenvConstraint(existingLockFileContent, config) {
    const { constraints = {} } = config;
    const { pipenv } = constraints;
    if (pipenv) {
        logger_1.logger.debug('Using pipenv constraint from config');
        return pipenv;
    }
    try {
        const pipfileLock = JSON.parse(existingLockFileContent);
        if (pipfileLock?.default?.pipenv?.version) {
            const pipenvVersion = pipfileLock.default.pipenv.version;
            return pipenvVersion;
        }
        if (pipfileLock?.develop?.pipenv?.version) {
            const pipenvVersion = pipfileLock.develop.pipenv.version;
            return pipenvVersion;
        }
    }
    catch (err) {
        // Do nothing
    }
    return '';
}
async function updateArtifacts({ packageFileName: pipfileName, newPackageFileContent: newPipfileContent, config, }) {
    logger_1.logger.debug(`pipenv.updateArtifacts(${pipfileName})`);
    const lockFileName = pipfileName + '.lock';
    const existingLockFileContent = await (0, fs_1.readLocalFile)(lockFileName, 'utf8');
    if (!existingLockFileContent) {
        logger_1.logger.debug('No Pipfile.lock found');
        return null;
    }
    try {
        await (0, fs_1.writeLocalFile)(pipfileName, newPipfileContent);
        if (config.isLockFileMaintenance) {
            await (0, fs_1.deleteLocalFile)(lockFileName);
        }
        const cmd = 'pipenv lock';
        const tagConstraint = getPythonConstraint(existingLockFileContent, config);
        const pipenvConstraint = getPipenvConstraint(existingLockFileContent, config);
        const execOptions = {
            cwdFile: pipfileName,
            extraEnv: {
                PIPENV_CACHE_DIR: await (0, fs_1.ensureCacheDir)('pipenv'),
            },
            docker: {
                image: 'python',
                tagConstraint,
                tagScheme: 'pep440',
            },
            preCommands: [`pip install --user ${(0, shlex_1.quote)(`pipenv${pipenvConstraint}`)}`],
        };
        logger_1.logger.debug({ cmd }, 'pipenv lock command');
        await (0, exec_1.exec)(cmd, execOptions);
        const status = await (0, git_1.getRepoStatus)();
        if (!status?.modified.includes(lockFileName)) {
            return null;
        }
        logger_1.logger.debug('Returning updated Pipfile.lock');
        return [
            {
                file: {
                    type: 'addition',
                    path: lockFileName,
                    contents: await (0, fs_1.readLocalFile)(lockFileName, 'utf8'),
                },
            },
        ];
    }
    catch (err) {
        // istanbul ignore if
        if (err.message === error_messages_1.TEMPORARY_ERROR) {
            throw err;
        }
        logger_1.logger.debug({ err }, 'Failed to update Pipfile.lock');
        return [
            {
                artifactError: {
                    lockFile: lockFileName,
                    stderr: err.message,
                },
            },
        ];
    }
}
exports.updateArtifacts = updateArtifacts;
//# sourceMappingURL=artifacts.js.map