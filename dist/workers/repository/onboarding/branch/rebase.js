"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rebaseOnboardingBranch = void 0;
const app_strings_1 = require("../../../../config/app-strings");
const global_1 = require("../../../../config/global");
const logger_1 = require("../../../../logger");
const commit_1 = require("../../../../modules/platform/commit");
const git_1 = require("../../../../util/git");
const commit_message_1 = require("./commit-message");
const config_1 = require("./config");
const defaultConfigFile = (config) => app_strings_1.configFileNames.includes(config.onboardingConfigFileName)
    ? config.onboardingConfigFileName
    : app_strings_1.configFileNames[0];
async function rebaseOnboardingBranch(config) {
    logger_1.logger.debug('Checking if onboarding branch needs rebasing');
    if (await (0, git_1.isBranchModified)(config.onboardingBranch)) {
        logger_1.logger.debug('Onboarding branch has been edited and cannot be rebased');
        return null;
    }
    const configFile = defaultConfigFile(config);
    const existingContents = await (0, git_1.getFile)(configFile, config.onboardingBranch);
    const contents = await (0, config_1.getOnboardingConfigContents)(config, configFile);
    if (contents === existingContents &&
        !(await (0, git_1.isBranchStale)(config.onboardingBranch))) {
        logger_1.logger.debug('Onboarding branch is up to date');
        return null;
    }
    logger_1.logger.debug('Rebasing onboarding branch');
    // istanbul ignore next
    const commitMessageFactory = new commit_message_1.OnboardingCommitMessageFactory(config, configFile);
    const commitMessage = commitMessageFactory.create();
    // istanbul ignore if
    if (global_1.GlobalConfig.get('dryRun')) {
        logger_1.logger.info('DRY-RUN: Would rebase files in onboarding branch');
        return null;
    }
    return (0, commit_1.commitAndPush)({
        branchName: config.onboardingBranch,
        files: [
            {
                type: 'addition',
                path: configFile,
                contents,
            },
        ],
        message: commitMessage.toString(),
        platformCommit: !!config.platformCommit,
    });
}
exports.rebaseOnboardingBranch = rebaseOnboardingBranch;
//# sourceMappingURL=rebase.js.map