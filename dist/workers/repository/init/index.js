"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initRepo = void 0;
const global_1 = require("../../../config/global");
const secrets_1 = require("../../../config/secrets");
const logger_1 = require("../../../logger");
const platform_1 = require("../../../modules/platform");
const clone_1 = require("../../../util/clone");
const git_1 = require("../../../util/git");
const configured_1 = require("../configured");
const package_files_1 = require("../package-files");
const apis_1 = require("./apis");
const cache_1 = require("./cache");
const config_1 = require("./config");
const vulnerability_1 = require("./vulnerability");
function initializeConfig(config) {
    return { ...(0, clone_1.clone)(config), errors: [], warnings: [], branchList: [] };
}
function warnOnUnsupportedOptions(config) {
    if (config.filterUnavailableUsers && !platform_1.platform.filterUnavailableUsers) {
        const platform = global_1.GlobalConfig.get('platform');
        logger_1.logger.warn(`Configuration option 'filterUnavailableUsers' is not supported on the current platform '${platform}'.`);
    }
}
async function initRepo(config_) {
    package_files_1.PackageFiles.clear();
    let config = initializeConfig(config_);
    await (0, cache_1.resetCaches)();
    config = await (0, apis_1.initApis)(config);
    await (0, cache_1.initializeCaches)(config);
    config = await (0, config_1.getRepoConfig)(config);
    (0, configured_1.checkIfConfigured)(config);
    warnOnUnsupportedOptions(config);
    config = (0, secrets_1.applySecretsToConfig)(config);
    (0, git_1.setUserRepoConfig)(config);
    config = await (0, vulnerability_1.detectVulnerabilityAlerts)(config);
    // istanbul ignore if
    if (config.printConfig) {
        logger_1.logger.info({ config }, 'Full resolved config including presets');
    }
    return config;
}
exports.initRepo = initRepo;
//# sourceMappingURL=index.js.map