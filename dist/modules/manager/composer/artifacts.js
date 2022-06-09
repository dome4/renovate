"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateArtifacts = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const shlex_1 = require("shlex");
const constants_1 = require("../../../constants");
const error_messages_1 = require("../../../constants/error-messages");
const logger_1 = require("../../../logger");
const exec_1 = require("../../../util/exec");
const fs_1 = require("../../../util/fs");
const git_1 = require("../../../util/git");
const hostRules = tslib_1.__importStar(require("../../../util/host-rules"));
const regex_1 = require("../../../util/regex");
const packagist_1 = require("../../datasource/packagist");
const utils_1 = require("./utils");
function getAuthJson() {
    const authJson = {};
    const githubCredentials = hostRules.find({
        hostType: constants_1.PlatformId.Github,
        url: 'https://api.github.com/',
    });
    if (githubCredentials?.token) {
        authJson['github-oauth'] = {
            'github.com': githubCredentials.token.replace('x-access-token:', ''),
        };
    }
    hostRules
        .findAll({ hostType: constants_1.PlatformId.Gitlab })
        ?.forEach((gitlabHostRule) => {
        if (gitlabHostRule?.token) {
            const host = gitlabHostRule.resolvedHost || 'gitlab.com';
            authJson['gitlab-token'] = authJson['gitlab-token'] || {};
            authJson['gitlab-token'][host] = gitlabHostRule.token;
            // https://getcomposer.org/doc/articles/authentication-for-private-packages.md#gitlab-token
            authJson['gitlab-domains'] = [
                host,
                ...(authJson['gitlab-domains'] || []),
            ];
        }
    });
    hostRules
        .findAll({ hostType: packagist_1.PackagistDatasource.id })
        ?.forEach((hostRule) => {
        const { resolvedHost, username, password, token } = hostRule;
        if (resolvedHost && username && password) {
            authJson['http-basic'] = authJson['http-basic'] || {};
            authJson['http-basic'][resolvedHost] = { username, password };
        }
        else if (resolvedHost && token) {
            authJson.bearer = authJson.bearer || {};
            authJson.bearer[resolvedHost] = token;
        }
    });
    return is_1.default.emptyObject(authJson) ? null : JSON.stringify(authJson);
}
async function updateArtifacts({ packageFileName, updatedDeps, newPackageFileContent, config, }) {
    logger_1.logger.debug(`composer.updateArtifacts(${packageFileName})`);
    const lockFileName = packageFileName.replace((0, regex_1.regEx)(/\.json$/), '.lock');
    const existingLockFileContent = await (0, fs_1.readLocalFile)(lockFileName, 'utf8');
    if (!existingLockFileContent) {
        logger_1.logger.debug('No composer.lock found');
        return null;
    }
    const vendorDir = (0, fs_1.getSiblingFileName)(packageFileName, 'vendor');
    const commitVendorFiles = await (0, fs_1.localPathExists)(vendorDir);
    await (0, fs_1.ensureLocalDir)(vendorDir);
    try {
        await (0, fs_1.writeLocalFile)(packageFileName, newPackageFileContent);
        const existingLockFile = JSON.parse(existingLockFileContent);
        const constraints = {
            ...(0, utils_1.extractContraints)(JSON.parse(newPackageFileContent), existingLockFile),
            ...config.constraints,
        };
        const composerToolConstraint = {
            toolName: 'composer',
            constraint: constraints.composer,
        };
        const execOptions = {
            cwdFile: packageFileName,
            extraEnv: {
                COMPOSER_CACHE_DIR: await (0, fs_1.ensureCacheDir)('composer'),
                COMPOSER_AUTH: getAuthJson(),
            },
            toolConstraints: [composerToolConstraint],
            docker: {
                image: 'php',
                tagConstraint: (0, utils_1.getPhpConstraint)(constraints),
                tagScheme: utils_1.composerVersioningId,
            },
        };
        const commands = [];
        // Determine whether install is required before update
        if ((0, utils_1.requireComposerDependencyInstallation)(existingLockFile)) {
            const preCmd = 'composer';
            const preArgs = 'install' + (0, utils_1.getComposerArguments)(config, composerToolConstraint);
            logger_1.logger.debug({ preCmd, preArgs }, 'composer pre-update command');
            commands.push(`${preCmd} ${preArgs}`);
        }
        const cmd = 'composer';
        let args;
        if (config.isLockFileMaintenance) {
            args = 'update';
        }
        else {
            args =
                ('update ' +
                    updatedDeps
                        .map((dep) => dep.depName)
                        .filter(is_1.default.string)
                        .map((dep) => (0, shlex_1.quote)(dep))
                        .join(' ')).trim() + ' --with-dependencies';
        }
        args += (0, utils_1.getComposerArguments)(config, composerToolConstraint);
        logger_1.logger.debug({ cmd, args }, 'composer command');
        commands.push(`${cmd} ${args}`);
        await (0, exec_1.exec)(commands, execOptions);
        const status = await (0, git_1.getRepoStatus)();
        if (!status.modified.includes(lockFileName)) {
            return null;
        }
        logger_1.logger.debug('Returning updated composer.lock');
        const res = [
            {
                file: {
                    type: 'addition',
                    path: lockFileName,
                    contents: await (0, fs_1.readLocalFile)(lockFileName),
                },
            },
        ];
        if (!commitVendorFiles) {
            return res;
        }
        logger_1.logger.debug(`Committing vendor files in ${vendorDir}`);
        for (const f of [...status.modified, ...status.not_added]) {
            if (f.startsWith(vendorDir)) {
                res.push({
                    file: {
                        type: 'addition',
                        path: f,
                        contents: await (0, fs_1.readLocalFile)(f),
                    },
                });
            }
        }
        for (const f of status.deleted) {
            res.push({
                file: {
                    type: 'deletion',
                    path: f,
                },
            });
        }
        return res;
    }
    catch (err) {
        // istanbul ignore if
        if (err.message === error_messages_1.TEMPORARY_ERROR) {
            throw err;
        }
        if (err.message?.includes('Your requirements could not be resolved to an installable set of packages.')) {
            logger_1.logger.info('Composer requirements cannot be resolved');
        }
        else if (err.message?.includes('write error (disk full?)')) {
            throw new Error(error_messages_1.SYSTEM_INSUFFICIENT_DISK_SPACE);
        }
        else {
            logger_1.logger.debug({ err }, 'Failed to generate composer.lock');
        }
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