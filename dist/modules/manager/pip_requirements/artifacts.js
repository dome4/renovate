"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateArtifacts = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const error_messages_1 = require("../../../constants/error-messages");
const logger_1 = require("../../../logger");
const exec_1 = require("../../../util/exec");
const fs_1 = require("../../../util/fs");
const regex_1 = require("../../../util/regex");
async function updateArtifacts({ packageFileName, updatedDeps, newPackageFileContent, config, }) {
    logger_1.logger.debug(`pip_requirements.updateArtifacts(${packageFileName})`);
    if (!is_1.default.nonEmptyArray(updatedDeps)) {
        logger_1.logger.debug('No updated pip_requirements deps - returning null');
        return null;
    }
    try {
        const cmd = [];
        const rewrittenContent = newPackageFileContent.replace((0, regex_1.regEx)(/\\\n/g), '');
        const lines = rewrittenContent
            .split(regex_1.newlineRegex)
            .map((line) => line.trim());
        for (const dep of updatedDeps) {
            const hashLine = lines.find((line) => line.startsWith(`${dep.depName}==`) && line.includes('--hash='));
            if (hashLine) {
                const depConstraint = hashLine.split(' ')[0];
                cmd.push(`hashin ${depConstraint} -r ${packageFileName}`);
            }
        }
        if (!cmd.length) {
            logger_1.logger.debug('No hashin commands to run - returning');
            return null;
        }
        const execOptions = {
            cwdFile: '.',
            docker: {
                image: 'python',
                tagScheme: 'pip_requirements',
            },
            preCommands: ['pip install hashin'],
        };
        await (0, exec_1.exec)(cmd, execOptions);
        const newContent = await (0, fs_1.readLocalFile)(packageFileName, 'utf8');
        if (newContent === newPackageFileContent) {
            logger_1.logger.debug(`${packageFileName} is unchanged`);
            return null;
        }
        logger_1.logger.debug(`Returning updated ${packageFileName}`);
        return [
            {
                file: {
                    type: 'addition',
                    path: packageFileName,
                    contents: newContent,
                },
            },
        ];
    }
    catch (err) {
        // istanbul ignore if
        if (err.message === error_messages_1.TEMPORARY_ERROR) {
            throw err;
        }
        logger_1.logger.debug({ err }, `Failed to update ${packageFileName} file`);
        return [
            {
                artifactError: {
                    lockFile: packageFileName,
                    stderr: `${String(err.stdout)}\n${String(err.stderr)}`,
                },
            },
        ];
    }
}
exports.updateArtifacts = updateArtifacts;
//# sourceMappingURL=artifacts.js.map