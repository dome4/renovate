"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prAlreadyExisted = void 0;
const error_messages_1 = require("../../../../constants/error-messages");
const logger_1 = require("../../../../logger");
const platform_1 = require("../../../../modules/platform");
const types_1 = require("../../../../types");
async function prAlreadyExisted(config) {
    logger_1.logger.trace({ config }, 'prAlreadyExisted');
    if (config.recreateClosed) {
        logger_1.logger.debug('recreateClosed is true');
        return null;
    }
    logger_1.logger.debug('recreateClosed is false');
    // Return if same PR already existed
    let pr = await platform_1.platform.findPr({
        branchName: config.branchName,
        prTitle: config.prTitle,
        state: types_1.PrState.NotOpen,
    });
    if (!pr && config.branchPrefix !== config.branchPrefixOld) {
        pr = await platform_1.platform.findPr({
            branchName: config.branchName.replace(config.branchPrefix, config.branchPrefixOld),
            prTitle: config.prTitle,
            state: types_1.PrState.NotOpen,
        });
        if (pr) {
            logger_1.logger.debug('Found closed PR with branchPrefixOld');
        }
    }
    if (pr) {
        logger_1.logger.debug('Found closed PR with current title');
        const prDetails = await platform_1.platform.getPr(pr.number);
        // istanbul ignore if
        if (prDetails.state === types_1.PrState.Open) {
            logger_1.logger.debug('PR reopened - aborting run');
            throw new Error(error_messages_1.REPOSITORY_CHANGED);
        }
        return pr;
    }
    logger_1.logger.debug('prAlreadyExisted=false');
    return null;
}
exports.prAlreadyExisted = prAlreadyExisted;
//# sourceMappingURL=check-existing.js.map