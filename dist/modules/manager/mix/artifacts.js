"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateArtifacts = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const shlex_1 = require("shlex");
const error_messages_1 = require("../../../constants/error-messages");
const logger_1 = require("../../../logger");
const exec_1 = require("../../../util/exec");
const fs_1 = require("../../../util/fs");
const hostRules = tslib_1.__importStar(require("../../../util/host-rules"));
const hexRepoUrl = 'https://hex.pm/';
async function updateArtifacts({ packageFileName, updatedDeps, newPackageFileContent, }) {
    logger_1.logger.debug(`mix.getArtifacts(${packageFileName})`);
    if (updatedDeps.length < 1) {
        logger_1.logger.debug('No updated mix deps - returning null');
        return null;
    }
    const lockFileName = (await (0, fs_1.findLocalSiblingOrParent)(packageFileName, 'mix.lock')) || 'mix.lock';
    try {
        await (0, fs_1.writeLocalFile)(packageFileName, newPackageFileContent);
    }
    catch (err) {
        logger_1.logger.warn({ err }, 'mix.exs could not be written');
        return [
            {
                artifactError: {
                    lockFile: lockFileName,
                    stderr: err.message,
                },
            },
        ];
    }
    const existingLockFileContent = await (0, fs_1.readLocalFile)(lockFileName, 'utf8');
    if (!existingLockFileContent) {
        logger_1.logger.debug('No mix.lock found');
        return null;
    }
    const organizations = new Set();
    for (const { packageName } of updatedDeps) {
        if (packageName) {
            const [, organization] = packageName.split(':');
            if (organization) {
                organizations.add(organization);
            }
        }
    }
    const preCommands = Array.from(organizations).reduce((acc, organization) => {
        const url = `${hexRepoUrl}api/repos/${organization}/`;
        const { token } = hostRules.find({ url });
        if (token) {
            logger_1.logger.debug(`Authenticating to hex organization ${organization}`);
            const authCommand = `mix hex.organization auth ${organization} --key ${token}`;
            return [...acc, authCommand];
        }
        return acc;
    }, []);
    const execOptions = {
        cwdFile: packageFileName,
        docker: {
            image: 'elixir',
        },
        preCommands,
    };
    const command = [
        'mix',
        'deps.update',
        ...updatedDeps
            .map((dep) => dep.depName)
            .filter(is_1.default.string)
            .map((dep) => (0, shlex_1.quote)(dep)),
    ].join(' ');
    try {
        await (0, exec_1.exec)(command, execOptions);
    }
    catch (err) {
        // istanbul ignore if
        if (err.message === error_messages_1.TEMPORARY_ERROR) {
            throw err;
        }
        logger_1.logger.debug({ err, message: err.message, command }, 'Failed to update Mix lock file');
        return [
            {
                artifactError: {
                    lockFile: lockFileName,
                    stderr: err.message,
                },
            },
        ];
    }
    const newMixLockContent = await (0, fs_1.readLocalFile)(lockFileName, 'utf8');
    if (existingLockFileContent === newMixLockContent) {
        logger_1.logger.debug('mix.lock is unchanged');
        return null;
    }
    logger_1.logger.debug('Returning updated mix.lock');
    return [
        {
            file: {
                type: 'addition',
                path: lockFileName,
                contents: newMixLockContent,
            },
        },
    ];
}
exports.updateArtifacts = updateArtifacts;
//# sourceMappingURL=artifacts.js.map