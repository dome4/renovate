"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateArtifacts = void 0;
const tslib_1 = require("tslib");
const shlex_1 = require("shlex");
const upath_1 = tslib_1.__importDefault(require("upath"));
const error_messages_1 = require("../../../constants/error-messages");
const logger_1 = require("../../../logger");
const exec_1 = require("../../../util/exec");
const fs_1 = require("../../../util/fs");
const git_1 = require("../../../util/git");
const regex_1 = require("../../../util/regex");
const pluginRegex = (0, regex_1.regEx)(`^\\s*plugin\\s*(['"])(?<plugin>[^'"]+)(['"])`);
function getPluginCommands(content) {
    const result = new Set();
    const lines = content.split(regex_1.newlineRegex);
    lines.forEach((line) => {
        const match = pluginRegex.exec(line);
        if (match?.groups) {
            const { plugin } = match.groups;
            result.add(`gem install ${(0, shlex_1.quote)(plugin)}`);
        }
    });
    return [...result];
}
async function updateArtifacts({ packageFileName, updatedDeps, newPackageFileContent, config, }) {
    logger_1.logger.debug(`cocoapods.getArtifacts(${packageFileName})`);
    if (updatedDeps.length < 1) {
        logger_1.logger.debug('CocoaPods: empty update - returning null');
        return null;
    }
    const lockFileName = (0, fs_1.getSiblingFileName)(packageFileName, 'Podfile.lock');
    try {
        await (0, fs_1.writeLocalFile)(packageFileName, newPackageFileContent);
    }
    catch (err) {
        logger_1.logger.warn({ err }, 'Podfile could not be written');
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
        logger_1.logger.debug(`Lockfile not found: ${lockFileName}`);
        return null;
    }
    const match = (0, regex_1.regEx)(/^COCOAPODS: (?<cocoapodsVersion>.*)$/m).exec(existingLockFileContent);
    const cocoapods = match?.groups?.cocoapodsVersion ?? null;
    const cmd = [...getPluginCommands(newPackageFileContent), 'pod install'];
    const execOptions = {
        cwdFile: packageFileName,
        extraEnv: {
            CP_HOME_DIR: await (0, fs_1.ensureCacheDir)('cocoapods'),
        },
        docker: {
            image: 'ruby',
            tagScheme: 'ruby',
            tagConstraint: '< 3.0', // currently using v2 on docker image
        },
        toolConstraints: [
            {
                toolName: 'cocoapods',
                constraint: cocoapods,
            },
        ],
    };
    try {
        await (0, exec_1.exec)(cmd, execOptions);
    }
    catch (err) {
        // istanbul ignore if
        if (err.message === error_messages_1.TEMPORARY_ERROR) {
            throw err;
        }
        return [
            {
                artifactError: {
                    lockFile: lockFileName,
                    stderr: err.stderr || err.stdout || err.message,
                },
            },
        ];
    }
    const status = await (0, git_1.getRepoStatus)();
    if (!status.modified.includes(lockFileName)) {
        return null;
    }
    logger_1.logger.debug(`Returning updated lockfile: ${lockFileName}`);
    const lockFileContent = await (0, fs_1.readLocalFile)(lockFileName);
    const res = [
        {
            file: {
                type: 'addition',
                path: lockFileName,
                contents: lockFileContent,
            },
        },
    ];
    const podsDir = upath_1.default.join(upath_1.default.dirname(packageFileName), 'Pods');
    const podsManifestFileName = upath_1.default.join(podsDir, 'Manifest.lock');
    if (await (0, fs_1.readLocalFile)(podsManifestFileName, 'utf8')) {
        for (const f of status.modified.concat(status.not_added)) {
            if (f.startsWith(podsDir)) {
                res.push({
                    file: {
                        type: 'addition',
                        path: f,
                        contents: await (0, fs_1.readLocalFile)(f),
                    },
                });
            }
        }
        for (const f of status.deleted || []) {
            res.push({
                file: {
                    type: 'deletion',
                    path: f,
                },
            });
        }
    }
    return res;
}
exports.updateArtifacts = updateArtifacts;
//# sourceMappingURL=artifacts.js.map