"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isZeroInstall = exports.getZeroInstallPaths = exports.getYarnLock = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const core_1 = require("@yarnpkg/core");
const parsers_1 = require("@yarnpkg/parsers");
const logger_1 = require("../../../../logger");
const fs_1 = require("../../../../util/fs");
async function getYarnLock(filePath) {
    const yarnLockRaw = await (0, fs_1.readLocalFile)(filePath, 'utf8');
    try {
        const parsed = (0, parsers_1.parseSyml)(yarnLockRaw);
        const lockedVersions = {};
        let lockfileVersion;
        for (const [key, val] of Object.entries(parsed)) {
            if (key === '__metadata') {
                // yarn 2
                lockfileVersion = parseInt(val.cacheKey, 10);
            }
            else {
                for (const entry of key.split(', ')) {
                    const { scope, name, range } = core_1.structUtils.parseDescriptor(entry);
                    const packageName = scope ? `@${scope}/${name}` : name;
                    const { selector } = core_1.structUtils.parseRange(range);
                    logger_1.logger.trace({ entry, version: val.version });
                    lockedVersions[packageName + '@' + selector] = parsed[key].version;
                }
            }
        }
        return {
            isYarn1: !('__metadata' in parsed),
            lockfileVersion,
            lockedVersions,
        };
    }
    catch (err) {
        logger_1.logger.debug({ filePath, err }, 'Warning: Exception parsing yarn.lock');
        return { isYarn1: true, lockedVersions: {} };
    }
}
exports.getYarnLock = getYarnLock;
function getZeroInstallPaths(yarnrcYml) {
    const conf = (0, parsers_1.parseSyml)(yarnrcYml);
    const paths = [
        conf.cacheFolder || './.yarn/cache',
        '.pnp.cjs',
        '.pnp.js',
        '.pnp.loader.mjs',
    ];
    if (core_1.miscUtils.tryParseOptionalBoolean(conf.pnpEnableInlining) === false) {
        paths.push(conf.pnpDataPath || './.pnp.data.json');
    }
    return paths;
}
exports.getZeroInstallPaths = getZeroInstallPaths;
async function isZeroInstall(yarnrcYmlPath) {
    const yarnrcYml = await (0, fs_1.readLocalFile)(yarnrcYmlPath, 'utf8');
    if (is_1.default.string(yarnrcYml)) {
        const paths = getZeroInstallPaths(yarnrcYml);
        for (const p of paths) {
            if (await (0, fs_1.localPathExists)((0, fs_1.getSiblingFileName)(yarnrcYmlPath, p))) {
                logger_1.logger.debug(`Detected Yarn zero-install in ${p}`);
                return true;
            }
        }
    }
    return false;
}
exports.isZeroInstall = isZeroInstall;
//# sourceMappingURL=yarn.js.map