"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateRepo = exports.extractDependencies = void 0;
const config_1 = require("../../../config");
const global_1 = require("../../../config/global");
const error_messages_1 = require("../../../constants/error-messages");
const logger_1 = require("../../../logger");
const platform_1 = require("../../../modules/platform");
const repository_1 = require("../../../util/cache/repository");
const clone_1 = require("../../../util/clone");
const git_1 = require("../../../util/git");
const split_1 = require("../../../util/split");
const dependency_dashboard_1 = require("../dependency-dashboard");
const extract_update_1 = require("./extract-update");
async function getBaseBranchConfig(baseBranch, config) {
    logger_1.logger.debug(`baseBranch: ${baseBranch}`);
    let baseBranchConfig = (0, clone_1.clone)(config);
    if (config.useBaseBranchConfig === 'merge' &&
        baseBranch !== config.defaultBranch) {
        logger_1.logger.debug({ baseBranch }, `Merging config from base branch because useBaseBranchConfig=merge`);
        // Retrieve config file name autodetected for this repo
        const cache = (0, repository_1.getCache)();
        const configFileName = cache.configFileName;
        try {
            baseBranchConfig = await platform_1.platform.getJsonFile(configFileName, config.repository, baseBranch);
        }
        catch (err) {
            logger_1.logger.error({ configFileName, baseBranch }, `Error fetching config file from base branch - possible config name mismatch between branches?`);
            const error = new Error(error_messages_1.CONFIG_VALIDATION);
            error.validationSource = 'config';
            error.validationError = 'Error fetching config file';
            error.validationMessage = `Error fetching config file ${configFileName} from branch ${baseBranch}`;
            throw error;
        }
        baseBranchConfig = (0, config_1.mergeChildConfig)(config, baseBranchConfig);
        // baseBranches value should be based off the default branch
        baseBranchConfig.baseBranches = config.baseBranches;
    }
    if (config.baseBranches.length > 1) {
        baseBranchConfig.branchPrefix += `${baseBranch}-`;
        baseBranchConfig.hasBaseBranches = true;
    }
    baseBranchConfig = (0, config_1.mergeChildConfig)(baseBranchConfig, { baseBranch });
    return baseBranchConfig;
}
async function extractDependencies(config) {
    await (0, dependency_dashboard_1.readDashboardBody)(config);
    let res = {
        branches: [],
        branchList: [],
        packageFiles: null,
    };
    if (config.baseBranches?.length) {
        logger_1.logger.debug({ baseBranches: config.baseBranches }, 'baseBranches');
        const extracted = {};
        for (const baseBranch of config.baseBranches) {
            if ((0, git_1.branchExists)(baseBranch)) {
                const baseBranchConfig = await getBaseBranchConfig(baseBranch, config);
                extracted[baseBranch] = await (0, extract_update_1.extract)(baseBranchConfig);
            }
            else {
                logger_1.logger.warn({ baseBranch }, 'Base branch does not exist - skipping');
            }
        }
        (0, split_1.addSplit)('extract');
        for (const baseBranch of config.baseBranches) {
            if ((0, git_1.branchExists)(baseBranch)) {
                const baseBranchConfig = await getBaseBranchConfig(baseBranch, config);
                const packageFiles = extracted[baseBranch];
                const baseBranchRes = await (0, extract_update_1.lookup)(baseBranchConfig, packageFiles);
                res.branches = res.branches.concat(baseBranchRes?.branches);
                res.branchList = res.branchList.concat(baseBranchRes?.branchList);
                res.packageFiles = res.packageFiles || baseBranchRes?.packageFiles; // Use the first branch
            }
        }
    }
    else {
        logger_1.logger.debug('No baseBranches');
        const packageFiles = await (0, extract_update_1.extract)(config);
        (0, split_1.addSplit)('extract');
        if (global_1.GlobalConfig.get('dryRun') === 'extract') {
            res.packageFiles = packageFiles;
            logger_1.logger.info({ packageFiles }, 'Extracted dependencies');
            return res;
        }
        res = await (0, extract_update_1.lookup)(config, packageFiles);
    }
    (0, split_1.addSplit)('lookup');
    return res;
}
exports.extractDependencies = extractDependencies;
function updateRepo(config, branches) {
    logger_1.logger.debug('processRepo()');
    return (0, extract_update_1.update)(config, branches);
}
exports.updateRepo = updateRepo;
//# sourceMappingURL=index.js.map