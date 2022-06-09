"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onboardingPrExists = exports.isOnboarded = void 0;
const app_strings_1 = require("../../../../config/app-strings");
const error_messages_1 = require("../../../../constants/error-messages");
const logger_1 = require("../../../../logger");
const platform_1 = require("../../../../modules/platform");
const comment_1 = require("../../../../modules/platform/comment");
const types_1 = require("../../../../types");
const repository_1 = require("../../../../util/cache/repository");
const fs_1 = require("../../../../util/fs");
const git_1 = require("../../../../util/git");
const findFile = async (fileName) => {
    logger_1.logger.debug(`findFile(${fileName})`);
    const fileList = await (0, git_1.getFileList)();
    return fileList.includes(fileName);
};
const configFileExists = async () => {
    for (const fileName of app_strings_1.configFileNames) {
        if (fileName !== 'package.json' && (await findFile(fileName))) {
            logger_1.logger.debug({ fileName }, 'Config file exists');
            return true;
        }
    }
    return false;
};
const packageJsonConfigExists = async () => {
    try {
        const pJson = JSON.parse(await (0, fs_1.readLocalFile)('package.json', 'utf8'));
        if (pJson.renovate) {
            return true;
        }
    }
    catch (err) {
        // Do nothing
    }
    return false;
};
const closedPrExists = (config) => platform_1.platform.findPr({
    branchName: config.onboardingBranch,
    prTitle: config.onboardingPrTitle,
    state: types_1.PrState.NotOpen,
});
const isOnboarded = async (config) => {
    logger_1.logger.debug('isOnboarded()');
    const title = `Action required: Add a Renovate config`;
    // Repo is onboarded if global config is bypassing onboarding and does not require a
    // configuration file.
    if (config.requireConfig === 'optional' && config.onboarding === false) {
        // Return early and avoid checking for config files
        return true;
    }
    if (config.requireConfig === 'ignored') {
        logger_1.logger.debug('Config file will be ignored');
        return true;
    }
    const cache = (0, repository_1.getCache)();
    if (cache.configFileName) {
        logger_1.logger.debug('Checking cached config file name');
        try {
            const configFileContent = await platform_1.platform.getJsonFile(cache.configFileName);
            if (configFileContent) {
                if (cache.configFileName !== 'package.json' ||
                    configFileContent.renovate) {
                    logger_1.logger.debug('Existing config file confirmed');
                    return true;
                }
            }
        }
        catch (err) {
            // probably file doesn't exist
        }
        logger_1.logger.debug('Existing config file no longer exists');
        delete cache.configFileName;
    }
    if (await configFileExists()) {
        await platform_1.platform.ensureIssueClosing(title);
        return true;
    }
    logger_1.logger.debug('config file not found');
    if (await packageJsonConfigExists()) {
        logger_1.logger.debug('package.json contains config');
        await platform_1.platform.ensureIssueClosing(title);
        return true;
    }
    // If onboarding has been disabled and config files are required then the
    // repository has not been onboarded yet
    if (config.requireConfig === 'required' && config.onboarding === false) {
        throw new Error(error_messages_1.REPOSITORY_NO_CONFIG);
    }
    const pr = await closedPrExists(config);
    if (!pr) {
        logger_1.logger.debug('Found no closed onboarding PR');
        return false;
    }
    logger_1.logger.debug('Found closed onboarding PR');
    if (config.requireConfig === 'optional') {
        logger_1.logger.debug('Config not mandatory so repo is considered onboarded');
        return true;
    }
    logger_1.logger.debug('Repo is not onboarded and no merged PRs exist');
    if (!config.suppressNotifications.includes('onboardingClose')) {
        // ensure PR comment
        await (0, comment_1.ensureComment)({
            number: pr.number,
            topic: `Renovate is disabled`,
            content: `Renovate is disabled due to lack of config. If you wish to reenable it, you can either (a) commit a config file to your base branch, or (b) rename this closed PR to trigger a replacement onboarding PR.`,
        });
    }
    throw new Error(error_messages_1.REPOSITORY_CLOSED_ONBOARDING);
};
exports.isOnboarded = isOnboarded;
const onboardingPrExists = async (config) => !!(await platform_1.platform.getBranchPr(config.onboardingBranch));
exports.onboardingPrExists = onboardingPrExists;
//# sourceMappingURL=check.js.map