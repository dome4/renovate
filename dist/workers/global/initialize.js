"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalFinalize = exports.globalInitialize = void 0;
const tslib_1 = require("tslib");
const os_1 = tslib_1.__importDefault(require("os"));
const fs_extra_1 = tslib_1.__importDefault(require("fs-extra"));
const upath_1 = tslib_1.__importDefault(require("upath"));
const logger_1 = require("../../logger");
const platform_1 = require("../../modules/platform");
const packageCache = tslib_1.__importStar(require("../../util/cache/package"));
const emoji_1 = require("../../util/emoji");
const git_1 = require("../../util/git");
const hostRules = tslib_1.__importStar(require("../../util/host-rules"));
const limits_1 = require("./limits");
async function setDirectories(input) {
    const config = { ...input };
    process.env.TMPDIR = process.env.RENOVATE_TMPDIR || os_1.default.tmpdir();
    if (config.baseDir) {
        logger_1.logger.debug('Using configured baseDir: ' + config.baseDir);
    }
    else {
        config.baseDir = upath_1.default.join(process.env.TMPDIR, 'renovate');
        logger_1.logger.debug('Using baseDir: ' + config.baseDir);
    }
    await fs_extra_1.default.ensureDir(config.baseDir);
    if (config.cacheDir) {
        logger_1.logger.debug('Using configured cacheDir: ' + config.cacheDir);
    }
    else {
        config.cacheDir = upath_1.default.join(config.baseDir, 'cache');
        logger_1.logger.debug('Using cacheDir: ' + config.cacheDir);
    }
    await fs_extra_1.default.ensureDir(config.cacheDir);
    return config;
}
function limitCommitsPerRun(config) {
    let limit = config.prCommitsPerRunLimit;
    limit = typeof limit === 'number' && limit > 0 ? limit : null;
    (0, limits_1.setMaxLimit)(limits_1.Limit.Commits, limit);
}
async function checkVersions() {
    const validGitVersion = await (0, git_1.validateGitVersion)();
    if (!validGitVersion) {
        throw new Error('Init: git version needs upgrading');
    }
}
function setGlobalHostRules(config) {
    if (config.hostRules) {
        logger_1.logger.debug('Setting global hostRules');
        config.hostRules.forEach((rule) => hostRules.add(rule));
    }
}
async function globalInitialize(config_) {
    let config = config_;
    await checkVersions();
    config = await (0, platform_1.initPlatform)(config);
    config = await setDirectories(config);
    await packageCache.init(config);
    limitCommitsPerRun(config);
    (0, emoji_1.setEmojiConfig)(config);
    setGlobalHostRules(config);
    return config;
}
exports.globalInitialize = globalInitialize;
async function globalFinalize(config) {
    await packageCache.cleanup(config);
}
exports.globalFinalize = globalFinalize;
//# sourceMappingURL=initialize.js.map