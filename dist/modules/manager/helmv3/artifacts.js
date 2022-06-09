"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateArtifacts = void 0;
const tslib_1 = require("tslib");
const js_yaml_1 = tslib_1.__importDefault(require("js-yaml"));
const shlex_1 = require("shlex");
const upath_1 = tslib_1.__importDefault(require("upath"));
const error_messages_1 = require("../../../constants/error-messages");
const logger_1 = require("../../../logger");
const exec_1 = require("../../../util/exec");
const fs_1 = require("../../../util/fs");
const hostRules = tslib_1.__importStar(require("../../../util/host-rules"));
const docker_1 = require("../../datasource/docker");
const utils_1 = require("./utils");
async function helmCommands(execOptions, manifestPath, repositories) {
    const cmd = [];
    // set cache and config files to a path in privateCacheDir to prevent file and credential leakage
    const helmConfigParameters = [
        `--registry-config ${upath_1.default.join((0, fs_1.privateCacheDir)(), 'registry.json')}`,
        `--repository-config ${upath_1.default.join((0, fs_1.privateCacheDir)(), 'repositories.yaml')}`,
        `--repository-cache ${upath_1.default.join((0, fs_1.privateCacheDir)(), 'repositories')}`,
    ];
    // get OCI registries and detect host rules
    const registries = repositories
        .filter(utils_1.isOCIRegistry)
        .map((value) => {
        return {
            ...value,
            repository: value.repository.replace('oci://', ''),
            hostRule: hostRules.find({
                url: value.repository.replace('oci://', 'https://'),
                hostType: docker_1.DockerDatasource.id,
            }),
        };
    });
    // if credentials for the registry have been found, log into it
    registries.forEach((value) => {
        const { username, password } = value.hostRule;
        const parameters = [...helmConfigParameters];
        if (username && password) {
            parameters.push(`--username ${(0, shlex_1.quote)(username)}`);
            parameters.push(`--password ${(0, shlex_1.quote)(password)}`);
            cmd.push(`helm registry login ${parameters.join(' ')} ${value.repository}`);
        }
    });
    // find classic Chart repositories and fitting host rules
    const classicRepositories = repositories
        .filter((repository) => !(0, utils_1.isOCIRegistry)(repository))
        .map((value) => {
        return {
            ...value,
            hostRule: hostRules.find({
                url: value.repository,
            }),
        };
    });
    // add helm repos if an alias or credentials for the url are defined
    classicRepositories.forEach((value) => {
        const { username, password } = value.hostRule;
        const parameters = [...helmConfigParameters];
        const isPrivateRepo = username && password;
        if (isPrivateRepo) {
            parameters.push(`--username ${(0, shlex_1.quote)(username)}`);
            parameters.push(`--password ${(0, shlex_1.quote)(password)}`);
        }
        cmd.push(`helm repo add ${value.name} ${parameters.join(' ')} ${value.repository}`);
    });
    cmd.push(`helm dependency update ${helmConfigParameters.join(' ')} ${(0, shlex_1.quote)((0, fs_1.getSubDirectory)(manifestPath))}`);
    await (0, exec_1.exec)(cmd, execOptions);
}
async function updateArtifacts({ packageFileName, updatedDeps, newPackageFileContent, config, }) {
    logger_1.logger.debug(`helmv3.updateArtifacts(${packageFileName})`);
    const isLockFileMaintenance = config.updateType === 'lockFileMaintenance';
    if (!isLockFileMaintenance &&
        (updatedDeps === undefined || updatedDeps.length < 1)) {
        logger_1.logger.debug('No updated helmv3 deps - returning null');
        return null;
    }
    const lockFileName = (0, fs_1.getSiblingFileName)(packageFileName, 'Chart.lock');
    const existingLockFileContent = await (0, fs_1.readLocalFile)(lockFileName, 'utf8');
    if (!existingLockFileContent) {
        logger_1.logger.debug('No Chart.lock found');
        return null;
    }
    try {
        // get repositories and registries defined in the package file
        const packages = js_yaml_1.default.load(newPackageFileContent); //TODO #9610
        const locks = js_yaml_1.default.load(existingLockFileContent); //TODO #9610
        const chartDefinitions = [];
        // prioritize alias naming for Helm repositories
        if (config.aliases) {
            chartDefinitions.push({
                dependencies: (0, utils_1.aliasRecordToRepositories)(config.aliases),
            });
        }
        chartDefinitions.push(packages, locks);
        const repositories = (0, utils_1.getRepositories)(chartDefinitions);
        await (0, fs_1.writeLocalFile)(packageFileName, newPackageFileContent);
        logger_1.logger.debug('Updating ' + lockFileName);
        const helmToolConstraint = {
            toolName: 'helm',
            constraint: config.constraints?.helm,
        };
        const execOptions = {
            docker: {
                image: 'sidecar',
            },
            extraEnv: {
                HELM_EXPERIMENTAL_OCI: '1',
            },
            toolConstraints: [helmToolConstraint],
        };
        await helmCommands(execOptions, packageFileName, repositories);
        logger_1.logger.debug('Returning updated Chart.lock');
        const newHelmLockContent = await (0, fs_1.readLocalFile)(lockFileName, 'utf8');
        if (existingLockFileContent === newHelmLockContent) {
            logger_1.logger.debug('Chart.lock is unchanged');
            return null;
        }
        return [
            {
                file: {
                    type: 'addition',
                    path: lockFileName,
                    contents: newHelmLockContent,
                },
            },
        ];
    }
    catch (err) {
        // istanbul ignore if
        if (err.message === error_messages_1.TEMPORARY_ERROR) {
            throw err;
        }
        logger_1.logger.debug({ err }, 'Failed to update Helm lock file');
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