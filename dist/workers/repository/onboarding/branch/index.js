"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkOnboardingBranch = void 0;
const config_1 = require("../../../../config");
const global_1 = require("../../../../config/global");
const error_messages_1 = require("../../../../constants/error-messages");
const logger_1 = require("../../../../logger");
const platform_1 = require("../../../../modules/platform");
const git_1 = require("../../../../util/git");
const extract_1 = require("../../extract");
const merge_1 = require("../../init/merge");
const check_1 = require("./check");
const config_2 = require("./config");
const create_1 = require("./create");
const rebase_1 = require("./rebase");
async function checkOnboardingBranch(config) {
    logger_1.logger.debug('checkOnboarding()');
    logger_1.logger.trace({ config });
    let onboardingBranch = config.onboardingBranch;
    const repoIsOnboarded = await (0, check_1.isOnboarded)(config);
    if (repoIsOnboarded) {
        logger_1.logger.debug('Repo is onboarded');
        return { ...config, repoIsOnboarded };
    }
    if (config.isFork && !config.includeForks) {
        throw new Error(error_messages_1.REPOSITORY_FORKED);
    }
    logger_1.logger.debug('Repo is not onboarded');
    // global gitAuthor will need to be used
    (0, git_1.setGitAuthor)(config.gitAuthor);
    if (await (0, check_1.onboardingPrExists)(config)) {
        logger_1.logger.debug('Onboarding PR already exists');
        const commit = await (0, rebase_1.rebaseOnboardingBranch)(config);
        if (commit) {
            logger_1.logger.info({ branch: config.onboardingBranch, commit, onboarding: true }, 'Branch updated');
        }
        // istanbul ignore if
        if (platform_1.platform.refreshPr) {
            const onboardingPr = await platform_1.platform.getBranchPr(config.onboardingBranch);
            await platform_1.platform.refreshPr(onboardingPr.number);
        }
    }
    else {
        logger_1.logger.debug('Onboarding PR does not exist');
        const onboardingConfig = await (0, config_2.getOnboardingConfig)(config);
        let mergedConfig = (0, config_1.mergeChildConfig)(config, onboardingConfig);
        mergedConfig = await (0, merge_1.mergeRenovateConfig)(mergedConfig);
        onboardingBranch = mergedConfig.onboardingBranch;
        if (Object.entries(await (0, extract_1.extractAllDependencies)(mergedConfig)).length === 0) {
            if (!config?.onboardingNoDeps) {
                throw new Error(error_messages_1.REPOSITORY_NO_PACKAGE_FILES);
            }
        }
        logger_1.logger.debug('Need to create onboarding PR');
        const commit = await (0, create_1.createOnboardingBranch)(mergedConfig);
        // istanbul ignore if
        if (commit) {
            logger_1.logger.info({ branch: onboardingBranch, commit, onboarding: true }, 'Branch created');
        }
    }
    if (!global_1.GlobalConfig.get('dryRun')) {
        await (0, git_1.checkoutBranch)(onboardingBranch);
    }
    const branchList = [onboardingBranch];
    return { ...config, repoIsOnboarded, onboardingBranch, branchList };
}
exports.checkOnboardingBranch = checkOnboardingBranch;
//# sourceMappingURL=index.js.map