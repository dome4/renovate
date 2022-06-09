"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.raiseConfigWarningIssue = void 0;
const global_1 = require("../../config/global");
const logger_1 = require("../../logger");
const platform_1 = require("../../modules/platform");
const types_1 = require("../../types");
const regex_1 = require("../../util/regex");
async function raiseConfigWarningIssue(config, error) {
    logger_1.logger.debug('raiseConfigWarningIssue()');
    let body = `There is an error with this repository's Renovate configuration that needs to be fixed. As a precaution, Renovate will stop PRs until it is resolved.\n\n`;
    if (error.validationSource) {
        body += `Location: \`${error.validationSource}\`\n`;
    }
    body += `Error type: ${error.validationError}\n`;
    if (error.validationMessage) {
        body += `Message: \`${error.validationMessage.replace((0, regex_1.regEx)(/`/g), "'")}\`\n`;
    }
    const pr = await platform_1.platform.getBranchPr(config.onboardingBranch);
    if (pr?.state === types_1.PrState.Open) {
        logger_1.logger.debug('Updating onboarding PR with config error notice');
        body = `## Action Required: Fix Renovate Configuration\n\n${body}`;
        body += `\n\nOnce you have resolved this problem (in this onboarding branch), Renovate will return to providing you with a preview of your repository's configuration.`;
        if (global_1.GlobalConfig.get('dryRun')) {
            logger_1.logger.info(`DRY-RUN: Would update PR #${pr.number}`);
        }
        else {
            try {
                await platform_1.platform.updatePr({
                    number: pr.number,
                    prTitle: config.onboardingPrTitle,
                    prBody: body,
                });
            }
            catch (err) /* istanbul ignore next */ {
                logger_1.logger.warn({ err }, 'Error updating onboarding PR');
            }
        }
    }
    else if (global_1.GlobalConfig.get('dryRun')) {
        logger_1.logger.info('DRY-RUN: Would ensure config error issue');
    }
    else if (config.suppressNotifications?.includes('configErrorIssue')) {
        logger_1.logger.info('configErrorIssue - configuration failure, issues will be suppressed');
    }
    else {
        const once = false;
        const shouldReopen = config.configWarningReuseIssue;
        const res = await platform_1.platform.ensureIssue({
            title: `Action Required: Fix Renovate Configuration`,
            body,
            once,
            shouldReOpen: shouldReopen,
            confidential: config.confidential,
        });
        if (res === 'created') {
            logger_1.logger.warn({ configError: error, res }, 'Config Warning');
        }
    }
}
exports.raiseConfigWarningIssue = raiseConfigWarningIssue;
//# sourceMappingURL=error-config.js.map