"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateArtifacts = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const shlex_1 = require("shlex");
const upath_1 = tslib_1.__importDefault(require("upath"));
const global_1 = require("../../../config/global");
const error_messages_1 = require("../../../constants/error-messages");
const logger_1 = require("../../../logger");
const exec_1 = require("../../../util/exec");
const fs_1 = require("../../../util/fs");
const git_1 = require("../../../util/git");
const http_1 = require("../../../util/http");
const regex_1 = require("../../../util/regex");
const utils_1 = require("./utils");
const http = new http_1.Http('gradle-wrapper');
async function addIfUpdated(status, fileProjectPath) {
    if (status.modified.includes(fileProjectPath)) {
        return {
            file: {
                type: 'addition',
                path: fileProjectPath,
                contents: await (0, fs_1.readLocalFile)(fileProjectPath),
            },
        };
    }
    return null;
}
function getDistributionUrl(newPackageFileContent) {
    const distributionUrlLine = newPackageFileContent
        .split(regex_1.newlineRegex)
        .find((line) => line.startsWith('distributionUrl='));
    if (distributionUrlLine) {
        return distributionUrlLine
            .replace('distributionUrl=', '')
            .replace('https\\:', 'https:');
    }
    return null;
}
async function getDistributionChecksum(url) {
    const { body } = await http.get(`${url}.sha256`);
    return body;
}
async function updateArtifacts({ packageFileName, newPackageFileContent, updatedDeps, config, }) {
    try {
        const projectDir = global_1.GlobalConfig.get('localDir');
        logger_1.logger.debug({ updatedDeps }, 'gradle-wrapper.updateArtifacts()');
        const gradlew = (0, utils_1.gradleWrapperFileName)();
        const gradlewPath = upath_1.default.resolve(projectDir, `./${gradlew}`);
        let cmd = await (0, utils_1.prepareGradleCommand)(gradlew, 
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        projectDir, await (0, fs_1.stat)(gradlewPath).catch(() => null), `wrapper`);
        if (!cmd) {
            logger_1.logger.info('No gradlew found - skipping Artifacts update');
            return null;
        }
        const distributionUrl = getDistributionUrl(newPackageFileContent);
        if (distributionUrl) {
            cmd += ` --gradle-distribution-url ${distributionUrl}`;
            if (newPackageFileContent.includes('distributionSha256Sum=')) {
                //update checksum in case of distributionSha256Sum in properties then run wrapper
                const checksum = await getDistributionChecksum(distributionUrl);
                await (0, fs_1.writeLocalFile)(packageFileName, newPackageFileContent.replace(/distributionSha256Sum=.*/, `distributionSha256Sum=${checksum}`));
                cmd += ` --gradle-distribution-sha256-sum ${(0, shlex_1.quote)(checksum)}`;
            }
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            cmd += ` --gradle-version ${(0, shlex_1.quote)(config.newValue)}`;
        }
        logger_1.logger.debug(`Updating gradle wrapper: "${cmd}"`);
        const execOptions = {
            docker: {
                image: 'java',
                tagConstraint: 
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                config.constraints?.java ?? (0, utils_1.getJavaContraint)(config.currentValue),
                tagScheme: (0, utils_1.getJavaVersioning)(),
            },
            extraEnv: utils_1.extraEnv,
        };
        try {
            await (0, exec_1.exec)(cmd, execOptions);
        }
        catch (err) {
            // istanbul ignore if
            if (err.message === error_messages_1.TEMPORARY_ERROR) {
                throw err;
            }
            logger_1.logger.warn({ err }, 'Error executing gradle wrapper update command. It can be not a critical one though.');
        }
        const status = await (0, git_1.getRepoStatus)();
        const artifactFileNames = [
            'gradle/wrapper/gradle-wrapper.properties',
            'gradle/wrapper/gradle-wrapper.jar',
            'gradlew',
            'gradlew.bat',
        ].map((filename) => packageFileName
            .replace('gradle/wrapper/', '')
            .replace('gradle-wrapper.properties', '') + filename);
        const updateArtifactsResult = (await Promise.all(artifactFileNames.map((fileProjectPath) => addIfUpdated(status, fileProjectPath)))).filter(is_1.default.truthy);
        logger_1.logger.debug({ files: updateArtifactsResult.map((r) => r.file?.path) }, `Returning updated gradle-wrapper files`);
        return updateArtifactsResult;
    }
    catch (err) {
        logger_1.logger.debug({ err }, 'Error setting new Gradle Wrapper release value');
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