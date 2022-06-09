"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initPlatform = exports.setPlatformApi = exports.platform = exports.getPlatforms = exports.getPlatformList = void 0;
const tslib_1 = require("tslib");
const url_1 = tslib_1.__importDefault(require("url"));
const error_messages_1 = require("../../constants/error-messages");
const logger_1 = require("../../logger");
const git_1 = require("../../util/git");
const hostRules = tslib_1.__importStar(require("../../util/host-rules"));
const api_1 = tslib_1.__importDefault(require("./api"));
tslib_1.__exportStar(require("./types"), exports);
const getPlatformList = () => Array.from(api_1.default.keys());
exports.getPlatformList = getPlatformList;
const getPlatforms = () => api_1.default;
exports.getPlatforms = getPlatforms;
let _platform;
const handler = {
    get(_target, prop) {
        if (!_platform) {
            throw new Error(error_messages_1.PLATFORM_NOT_FOUND);
        }
        return _platform[prop];
    },
};
exports.platform = new Proxy({}, handler);
function setPlatformApi(name) {
    if (!api_1.default.has(name)) {
        throw new Error(`Init: Platform "${name}" not found. Must be one of: ${(0, exports.getPlatformList)().join(', ')}`);
    }
    _platform = api_1.default.get(name);
}
exports.setPlatformApi = setPlatformApi;
async function initPlatform(config) {
    (0, git_1.setPrivateKey)(config.gitPrivateKey);
    (0, git_1.setNoVerify)(config.gitNoVerify ?? []);
    // TODO: `platform` #7154
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    setPlatformApi(config.platform);
    // TODO: types
    const platformInfo = await exports.platform.initPlatform(config);
    const returnConfig = { ...config, ...platformInfo };
    // istanbul ignore else
    if (config?.gitAuthor) {
        logger_1.logger.debug(`Using configured gitAuthor (${config.gitAuthor})`);
        returnConfig.gitAuthor = config.gitAuthor;
    }
    else if (platformInfo?.gitAuthor) {
        logger_1.logger.debug(`Using platform gitAuthor: ${String(platformInfo.gitAuthor)}`);
        returnConfig.gitAuthor = platformInfo.gitAuthor;
    }
    // This is done for validation and will be overridden later once repo config is incorporated
    (0, git_1.setGitAuthor)(returnConfig.gitAuthor);
    const platformRule = {
        // TODO: null check #7154
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        matchHost: url_1.default.parse(returnConfig.endpoint).hostname,
    };
    ['token', 'username', 'password'].forEach((field) => {
        if (config[field]) {
            // TODO: types #7154
            platformRule[field] = config[field];
            delete returnConfig[field];
        }
    });
    returnConfig.hostRules = returnConfig.hostRules || [];
    const typedPlatformRule = {
        ...platformRule,
        hostType: returnConfig.platform,
    };
    returnConfig.hostRules.push(typedPlatformRule);
    hostRules.add(typedPlatformRule);
    return returnConfig;
}
exports.initPlatform = initPlatform;
//# sourceMappingURL=index.js.map