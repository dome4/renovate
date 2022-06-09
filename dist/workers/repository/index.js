"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renovateRepository = void 0;
const tslib_1 = require("tslib");
const fs_extra_1 = tslib_1.__importDefault(require("fs-extra"));
const global_1 = require("../../config/global");
const secrets_1 = require("../../config/secrets");
const expose_cjs_1 = require("../../expose.cjs");
const logger_1 = require("../../logger");
const docker_1 = require("../../util/exec/docker");
const fs_1 = require("../../util/fs");
const queue = tslib_1.__importStar(require("../../util/http/queue"));
const split_1 = require("../../util/split");
const cache_1 = require("./cache");
const dependency_dashboard_1 = require("./dependency-dashboard");
const error_1 = tslib_1.__importDefault(require("./error"));
const finalise_1 = require("./finalise");
const init_1 = require("./init");
const pr_1 = require("./onboarding/pr");
const process_1 = require("./process");
const result_1 = require("./result");
const stats_1 = require("./stats");
// istanbul ignore next
async function renovateRepository(repoConfig, canRetry = true) {
    (0, split_1.splitInit)();
    let config = global_1.GlobalConfig.set((0, secrets_1.applySecretsToConfig)(repoConfig, undefined, false));
    await (0, docker_1.removeDanglingContainers)();
    (0, logger_1.setMeta)({ repository: config.repository });
    logger_1.logger.info({ renovateVersion: expose_cjs_1.pkg.version }, 'Repository started');
    logger_1.logger.trace({ config });
    let repoResult;
    queue.clear();
    const { localDir } = global_1.GlobalConfig.get();
    try {
        await fs_extra_1.default.ensureDir(localDir);
        logger_1.logger.debug('Using localDir: ' + localDir);
        config = await (0, init_1.initRepo)(config);
        (0, split_1.addSplit)('init');
        const { branches, branchList, packageFiles } = await (0, process_1.extractDependencies)(config);
        if (global_1.GlobalConfig.get('dryRun') !== 'lookup' &&
            global_1.GlobalConfig.get('dryRun') !== 'extract') {
            await (0, pr_1.ensureOnboardingPr)(config, packageFiles, branches);
            const res = await (0, process_1.updateRepo)(config, branches);
            (0, logger_1.setMeta)({ repository: config.repository });
            (0, split_1.addSplit)('update');
            await (0, cache_1.setBranchCache)(branches);
            if (res === 'automerged') {
                if (canRetry) {
                    logger_1.logger.info('Renovating repository again after automerge result');
                    const recursiveRes = await renovateRepository(repoConfig, false);
                    return recursiveRes;
                }
                logger_1.logger.debug(`Automerged but already retried once`);
            }
            else {
                await (0, dependency_dashboard_1.ensureDependencyDashboard)(config, branches);
            }
            await (0, finalise_1.finaliseRepo)(config, branchList);
            repoResult = (0, result_1.processResult)(config, res);
        }
    }
    catch (err) /* istanbul ignore next */ {
        (0, logger_1.setMeta)({ repository: config.repository });
        const errorRes = await (0, error_1.default)(config, err);
        repoResult = (0, result_1.processResult)(config, errorRes);
    }
    if (localDir && !repoConfig.persistRepoData) {
        try {
            await (0, fs_1.deleteLocalFile)('.');
        }
        catch (err) /* istanbul ignore if */ {
            logger_1.logger.warn({ err }, 'localDir deletion error');
        }
    }
    try {
        await fs_extra_1.default.remove((0, fs_1.privateCacheDir)());
    }
    catch (err) /* istanbul ignore if */ {
        logger_1.logger.warn({ err }, 'privateCacheDir deletion error');
    }
    const splits = (0, split_1.getSplits)();
    logger_1.logger.debug(splits, 'Repository timing splits (milliseconds)');
    (0, stats_1.printRequestStats)();
    logger_1.logger.info({ durationMs: splits.total }, 'Repository finished');
    return repoResult;
}
exports.renovateRepository = renovateRepository;
//# sourceMappingURL=index.js.map