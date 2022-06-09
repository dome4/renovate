"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBranchesRemaining = exports.getConcurrentBranchesRemaining = exports.getPrsRemaining = exports.getConcurrentPrsRemaining = exports.getPrHourlyRemaining = void 0;
const luxon_1 = require("luxon");
const logger_1 = require("../../../logger");
const platform_1 = require("../../../modules/platform");
const types_1 = require("../../../types");
const external_host_error_1 = require("../../../types/errors/external-host-error");
const git_1 = require("../../../util/git");
async function getPrHourlyRemaining(config) {
    if (config.prHourlyLimit) {
        try {
            logger_1.logger.debug('Calculating hourly PRs remaining');
            const prList = await platform_1.platform.getPrList();
            const currentHourStart = luxon_1.DateTime.local().startOf('hour');
            logger_1.logger.debug(`currentHourStart=${String(currentHourStart)}`);
            const soFarThisHour = prList.filter((pr) => pr.sourceBranch !== config.onboardingBranch &&
                pr.sourceBranch.startsWith(config.branchPrefix) &&
                luxon_1.DateTime.fromISO(pr.createdAt) > currentHourStart);
            const prsRemaining = Math.max(0, config.prHourlyLimit - soFarThisHour.length);
            logger_1.logger.debug(`PR hourly limit remaining: ${prsRemaining}`);
            return prsRemaining;
        }
        catch (err) {
            // istanbul ignore if
            if (err instanceof external_host_error_1.ExternalHostError) {
                throw err;
            }
            logger_1.logger.error({ err }, 'Error checking PRs created per hour');
            return config.prHourlyLimit;
        }
    }
    return 99;
}
exports.getPrHourlyRemaining = getPrHourlyRemaining;
async function getConcurrentPrsRemaining(config, branches) {
    if (config.prConcurrentLimit) {
        logger_1.logger.debug(`Calculating prConcurrentLimit (${config.prConcurrentLimit})`);
        try {
            const openPrs = [];
            for (const { branchName } of branches) {
                try {
                    const pr = await platform_1.platform.getBranchPr(branchName);
                    if (pr &&
                        pr.sourceBranch !== config.onboardingBranch &&
                        pr.state === types_1.PrState.Open) {
                        openPrs.push(pr);
                    }
                }
                catch (err) {
                    // no-op
                }
            }
            logger_1.logger.debug(`${openPrs.length} PRs are currently open`);
            const concurrentRemaining = Math.max(0, config.prConcurrentLimit - openPrs.length);
            logger_1.logger.debug(`PR concurrent limit remaining: ${concurrentRemaining}`);
            return concurrentRemaining;
        }
        catch (err) /* istanbul ignore next */ {
            logger_1.logger.error({ err }, 'Error checking concurrent PRs');
            return config.prConcurrentLimit;
        }
    }
    return 99;
}
exports.getConcurrentPrsRemaining = getConcurrentPrsRemaining;
async function getPrsRemaining(config, branches) {
    const hourlyRemaining = await getPrHourlyRemaining(config);
    const concurrentRemaining = await getConcurrentPrsRemaining(config, branches);
    return Math.min(hourlyRemaining, concurrentRemaining);
}
exports.getPrsRemaining = getPrsRemaining;
function getConcurrentBranchesRemaining(config, branches) {
    const { branchConcurrentLimit, prConcurrentLimit } = config;
    const limit = typeof branchConcurrentLimit === 'number'
        ? branchConcurrentLimit
        : prConcurrentLimit;
    if (typeof limit === 'number' && limit) {
        logger_1.logger.debug(`Calculating branchConcurrentLimit (${limit})`);
        try {
            const existingBranches = [];
            for (const branch of branches) {
                if ((0, git_1.branchExists)(branch.branchName)) {
                    existingBranches.push(branch.branchName);
                }
            }
            const existingCount = existingBranches.length;
            logger_1.logger.debug(`${existingCount} already existing branches found: ${existingBranches.join()}`);
            const concurrentRemaining = Math.max(0, limit - existingCount);
            logger_1.logger.debug(`Branch concurrent limit remaining: ${concurrentRemaining}`);
            return concurrentRemaining;
        }
        catch (err) {
            logger_1.logger.error({ err }, 'Error checking concurrent branches');
            return limit;
        }
    }
    return 99;
}
exports.getConcurrentBranchesRemaining = getConcurrentBranchesRemaining;
async function getBranchesRemaining(config, branches) {
    const hourlyRemaining = await getPrHourlyRemaining(config);
    const concurrentRemaining = getConcurrentBranchesRemaining(config, branches);
    return Math.min(hourlyRemaining, concurrentRemaining);
}
exports.getBranchesRemaining = getBranchesRemaining;
//# sourceMappingURL=limits.js.map