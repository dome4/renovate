"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateArtifacts = void 0;
const shlex_1 = require("shlex");
const error_messages_1 = require("../../../constants/error-messages");
const logger_1 = require("../../../logger");
const exec_1 = require("../../../util/exec");
const fs_1 = require("../../../util/fs");
const git_1 = require("../../../util/git");
const regex_1 = require("../../../util/regex");
function dependencyUrl(dep) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const url = dep.packageName;
    if (dep.managerData?.subdir) {
        return url.concat('/', dep.managerData.subdir);
    }
    return url;
}
async function updateArtifacts(updateArtifact) {
    const { packageFileName, updatedDeps, config } = updateArtifact;
    logger_1.logger.trace({ packageFileName }, 'jsonnet-bundler.updateArtifacts()');
    const lockFileName = packageFileName.replace((0, regex_1.regEx)(/\.json$/), '.lock.json');
    const existingLockFileContent = await (0, fs_1.readLocalFile)(lockFileName, 'utf8');
    if (!existingLockFileContent) {
        logger_1.logger.debug('No jsonnetfile.lock.json found');
        return null;
    }
    const jsonnetBundlerToolConstraint = {
        toolName: 'jb',
        constraint: config.constraints?.jb,
    };
    const execOptions = {
        cwdFile: packageFileName,
        docker: {
            image: 'sidecar',
        },
        toolConstraints: [jsonnetBundlerToolConstraint],
    };
    try {
        if (config.isLockFileMaintenance) {
            await (0, exec_1.exec)('jb update', execOptions);
        }
        else {
            const dependencyUrls = updatedDeps.map(dependencyUrl);
            if (dependencyUrls.length > 0) {
                await (0, exec_1.exec)(`jb update ${dependencyUrls.map(shlex_1.quote).join(' ')}`, execOptions);
            }
        }
        const status = await (0, git_1.getRepoStatus)();
        if (status.isClean()) {
            return null;
        }
        const res = [];
        for (const f of status.modified ?? []) {
            res.push({
                file: { type: 'addition', path: f, contents: await (0, fs_1.readLocalFile)(f) },
            });
        }
        for (const f of status.not_added ?? []) {
            res.push({
                file: { type: 'addition', path: f, contents: await (0, fs_1.readLocalFile)(f) },
            });
        }
        for (const f of status.deleted ?? []) {
            res.push({
                file: {
                    type: 'deletion',
                    path: f,
                },
            });
        }
        return res;
    }
    catch (err) /* istanbul ignore next */ {
        if (err.message === error_messages_1.TEMPORARY_ERROR) {
            throw err;
        }
        return [
            {
                artifactError: {
                    lockFile: lockFileName,
                    stderr: err.stderr,
                },
            },
        ];
    }
}
exports.updateArtifacts = updateArtifacts;
//# sourceMappingURL=artifacts.js.map