"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateArtifacts = void 0;
const shlex_1 = require("shlex");
const logger_1 = require("../../../logger");
const exec_1 = require("../../../util/exec");
const fs_1 = require("../../../util/fs");
const common_1 = require("./common");
async function updateArtifacts({ packageFileName, updatedDeps, }) {
    const systemDep = updatedDeps[0];
    if (!(0, common_1.isSystemManifest)(packageFileName) || !systemDep?.newVersion) {
        return null;
    }
    const existingFileContent = await (0, fs_1.readLocalFile)(packageFileName);
    try {
        logger_1.logger.debug(`Updating Flux system manifests`);
        const args = ['--export'];
        if (systemDep.managerData?.components) {
            args.push('--components', (0, shlex_1.quote)(systemDep.managerData.components));
        }
        const cmd = `flux install ${args.join(' ')} > ${(0, shlex_1.quote)(packageFileName)}`;
        const execOptions = {
            docker: {
                image: 'sidecar',
            },
            toolConstraints: [
                {
                    toolName: 'flux',
                    constraint: updatedDeps[0].newVersion,
                },
            ],
        };
        const result = await (0, exec_1.exec)(cmd, execOptions);
        const newFileContent = await (0, fs_1.readLocalFile)(packageFileName);
        if (!newFileContent) {
            logger_1.logger.debug('Cannot read new flux file content');
            return [
                {
                    artifactError: {
                        lockFile: packageFileName,
                        stderr: result.stderr,
                    },
                },
            ];
        }
        if (newFileContent === existingFileContent) {
            logger_1.logger.debug('Flux contents are unchanged');
            return null;
        }
        return [
            {
                file: {
                    type: 'addition',
                    path: packageFileName,
                    contents: newFileContent,
                },
            },
        ];
    }
    catch (err) {
        logger_1.logger.debug({ err }, 'Error generating new Flux system manifests');
        return [
            {
                artifactError: {
                    lockFile: packageFileName,
                    stderr: err.message,
                },
            },
        ];
    }
}
exports.updateArtifacts = updateArtifacts;
//# sourceMappingURL=artifacts.js.map