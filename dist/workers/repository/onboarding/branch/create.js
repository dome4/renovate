"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOnboardingBranch = void 0;
const app_strings_1 = require("../../../../config/app-strings");
const global_1 = require("../../../../config/global");
const logger_1 = require("../../../../logger");
const commit_1 = require("../../../../modules/platform/commit");
const commit_message_1 = require("./commit-message");
const config_1 = require("./config");
const defaultConfigFile = app_strings_1.configFileNames[0];
async function createOnboardingBranch(config) {
    const configFile = app_strings_1.configFileNames.includes(config.onboardingConfigFileName)
        ? config.onboardingConfigFileName
        : defaultConfigFile;
    logger_1.logger.debug('createOnboardingBranch()');
    const contents = await (0, config_1.getOnboardingConfigContents)(config, configFile);
    logger_1.logger.debug('Creating onboarding branch');
    const commitMessageFactory = new commit_message_1.OnboardingCommitMessageFactory(config, configFile);
    const commitMessage = commitMessageFactory.create();
    // istanbul ignore if
    if (global_1.GlobalConfig.get('dryRun')) {
        logger_1.logger.info('DRY-RUN: Would commit files to onboarding branch');
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
exports.createOnboardingBranch = createOnboardingBranch;
//# sourceMappingURL=create.js.map