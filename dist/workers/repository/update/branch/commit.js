"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commitFilesToBranch = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const minimatch_1 = tslib_1.__importDefault(require("minimatch"));
const global_1 = require("../../../../config/global");
const error_messages_1 = require("../../../../constants/error-messages");
const logger_1 = require("../../../../logger");
const commit_1 = require("../../../../modules/platform/commit");
const sanitize_1 = require("../../../../util/sanitize");
function commitFilesToBranch(config) {
    let updatedFiles = config.updatedPackageFiles.concat(config.updatedArtifacts);
    // istanbul ignore if
    if (is_1.default.nonEmptyArray(config.excludeCommitPaths)) {
        updatedFiles = updatedFiles.filter(({ path: filePath }) => {
            const matchesExcludePaths = config.excludeCommitPaths.some((excludedPath) => (0, minimatch_1.default)(filePath, excludedPath, { dot: true }));
            if (matchesExcludePaths) {
                logger_1.logger.debug(`Excluding ${filePath} from commit`);
                return false;
            }
            return true;
        });
    }
    if (!is_1.default.nonEmptyArray(updatedFiles)) {
        logger_1.logger.debug(`No files to commit`);
        return null;
    }
    const fileLength = [...new Set(updatedFiles.map((file) => file.path))].length;
    logger_1.logger.debug(`${fileLength} file(s) to commit`);
    // istanbul ignore if
    if (global_1.GlobalConfig.get('dryRun')) {
        logger_1.logger.info('DRY-RUN: Would commit files to branch ' + config.branchName);
        return null;
    }
    // istanbul ignore if
    if (config.branchName !== (0, sanitize_1.sanitize)(config.branchName) ||
        config.commitMessage !== (0, sanitize_1.sanitize)(config.commitMessage)) {
        logger_1.logger.debug({ branchName: config.branchName }, 'Secrets exposed in branchName or commitMessage');
        throw new Error(error_messages_1.CONFIG_SECRETS_EXPOSED);
    }
    // API will know whether to create new branch or not
    return (0, commit_1.commitAndPush)({
        branchName: config.branchName,
        files: updatedFiles,
        message: config.commitMessage,
        force: !!config.forceCommit,
        platformCommit: !!config.platformCommit,
    });
}
exports.commitFilesToBranch = commitFilesToBranch;
//# sourceMappingURL=commit.js.map