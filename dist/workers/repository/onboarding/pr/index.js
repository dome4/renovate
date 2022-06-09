"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureOnboardingPr = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const global_1 = require("../../../../config/global");
const logger_1 = require("../../../../logger");
const platform_1 = require("../../../../modules/platform");
const pr_body_1 = require("../../../../modules/platform/pr-body");
const emoji_1 = require("../../../../util/emoji");
const git_1 = require("../../../../util/git");
const template = tslib_1.__importStar(require("../../../../util/template"));
const pr_1 = require("../../update/pr");
const labels_1 = require("../../update/pr/labels");
const participants_1 = require("../../update/pr/participants");
const base_branch_1 = require("./base-branch");
const config_description_1 = require("./config-description");
const errors_warnings_1 = require("./errors-warnings");
const pr_list_1 = require("./pr-list");
async function ensureOnboardingPr(config, packageFiles, branches) {
    if (config.repoIsOnboarded) {
        return;
    }
    logger_1.logger.debug('ensureOnboardingPr()');
    logger_1.logger.trace({ config });
    const existingPr = await platform_1.platform.getBranchPr(config.onboardingBranch);
    logger_1.logger.debug('Filling in onboarding PR template');
    let prTemplate = `Welcome to [Renovate](${config.productLinks.homepage})! This is an onboarding PR to help you understand and configure settings before regular Pull Requests begin.\n\n`;
    prTemplate +=
        config.requireConfig === 'required'
            ? (0, emoji_1.emojify)(`:vertical_traffic_light: To activate Renovate, merge this Pull Request. To disable Renovate, simply close this Pull Request unmerged.\n\n`)
            : (0, emoji_1.emojify)(`:vertical_traffic_light: Renovate will begin keeping your dependencies up-to-date only once you merge or close this Pull Request.\n\n`);
    prTemplate += (0, emoji_1.emojify)(`

---
{{PACKAGE FILES}}
{{CONFIG}}
{{BASEBRANCH}}
{{PRLIST}}
{{WARNINGS}}
{{ERRORS}}

---

:question: Got questions? Check out Renovate's [Docs](${config.productLinks.documentation}), particularly the Getting Started section.
If you need any further assistance then you can also [request help here](${config.productLinks.help}).
`);
    let prBody = prTemplate;
    if (packageFiles && Object.entries(packageFiles).length) {
        let files = [];
        for (const [manager, managerFiles] of Object.entries(packageFiles)) {
            files = files.concat(managerFiles.map((file) => ` * \`${file.packageFile}\` (${manager})`));
        }
        prBody =
            prBody.replace('{{PACKAGE FILES}}', '### Detected Package Files\n\n' + files.join('\n')) + '\n';
    }
    else {
        prBody = prBody.replace('{{PACKAGE FILES}}\n', '');
    }
    let configDesc = '';
    if (global_1.GlobalConfig.get('dryRun')) {
        logger_1.logger.info(`DRY-RUN: Would check branch ${config.onboardingBranch}`);
    }
    else if (await (0, git_1.isBranchModified)(config.onboardingBranch)) {
        configDesc = (0, emoji_1.emojify)(`### Configuration\n\n:abcd: Renovate has detected a custom config for this PR. Feel free to ask for [help](${config.productLinks.help}) if you have any doubts and would like it reviewed.\n\n`);
        const isConflicted = await (0, git_1.isBranchConflicted)(config.baseBranch, config.onboardingBranch);
        if (isConflicted) {
            configDesc += (0, emoji_1.emojify)(`:warning: This PR has a merge conflict, however Renovate is unable to automatically fix that due to edits in this branch. Please resolve the merge conflict manually.\n\n`);
        }
        else {
            configDesc += `Important: Now that this branch is edited, Renovate can't rebase it from the base branch any more. If you make changes to the base branch that could impact this onboarding PR, please merge them manually.\n\n`;
        }
    }
    else {
        configDesc = (0, config_description_1.getConfigDesc)(config, packageFiles);
    }
    prBody = prBody.replace('{{CONFIG}}\n', configDesc);
    prBody = prBody.replace('{{WARNINGS}}\n', (0, errors_warnings_1.getWarnings)(config) + (0, errors_warnings_1.getDepWarnings)(packageFiles));
    prBody = prBody.replace('{{ERRORS}}\n', (0, errors_warnings_1.getErrors)(config));
    prBody = prBody.replace('{{BASEBRANCH}}\n', (0, base_branch_1.getBaseBranchDesc)(config));
    prBody = prBody.replace('{{PRLIST}}\n', (0, pr_list_1.getPrList)(config, branches));
    if (is_1.default.string(config.prHeader)) {
        prBody = `${template.compile(config.prHeader, config)}\n\n${prBody}`;
    }
    if (is_1.default.string(config.prFooter)) {
        prBody = `${prBody}\n---\n\n${template.compile(config.prFooter, config)}\n`;
    }
    logger_1.logger.trace('prBody:\n' + prBody);
    prBody = platform_1.platform.massageMarkdown(prBody);
    if (existingPr) {
        logger_1.logger.debug('Found open onboarding PR');
        // Check if existing PR needs updating
        const prBodyHash = (0, pr_body_1.hashBody)(prBody);
        if (existingPr.bodyStruct?.hash === prBodyHash) {
            logger_1.logger.debug(`${existingPr.displayNumber} does not need updating`);
            return;
        }
        // PR must need updating
        if (global_1.GlobalConfig.get('dryRun')) {
            logger_1.logger.info('DRY-RUN: Would update onboarding PR');
        }
        else {
            await platform_1.platform.updatePr({
                number: existingPr.number,
                prTitle: existingPr.title,
                prBody,
            });
            logger_1.logger.info({ pr: existingPr.number }, 'Onboarding PR updated');
        }
        return;
    }
    logger_1.logger.debug('Creating onboarding PR');
    const labels = (0, labels_1.prepareLabels)(config);
    try {
        if (global_1.GlobalConfig.get('dryRun')) {
            logger_1.logger.info('DRY-RUN: Would create onboarding PR');
        }
        else {
            const pr = await platform_1.platform.createPr({
                sourceBranch: config.onboardingBranch,
                targetBranch: config.defaultBranch,
                prTitle: config.onboardingPrTitle,
                prBody,
                labels,
                platformOptions: (0, pr_1.getPlatformPrOptions)({ ...config, automerge: false }),
            });
            logger_1.logger.info({ pr: pr.displayNumber }, 'Onboarding PR created');
            await (0, participants_1.addParticipants)(config, pr);
        }
    }
    catch (err) {
        if (err.response?.statusCode === 422 &&
            err.response?.body?.errors?.[0]?.message?.startsWith('A pull request already exists')) {
            logger_1.logger.warn('Onboarding PR already exists but cannot find it. It was probably created by a different user.');
            await (0, git_1.deleteBranch)(config.onboardingBranch);
            return;
        }
        throw err;
    }
}
exports.ensureOnboardingPr = ensureOnboardingPr;
//# sourceMappingURL=index.js.map