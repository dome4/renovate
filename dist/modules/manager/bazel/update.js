"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDependency = void 0;
const tslib_1 = require("tslib");
const hasha_1 = tslib_1.__importDefault(require("hasha"));
const logger_1 = require("../../../logger");
const packageCache = tslib_1.__importStar(require("../../../util/cache/package"));
const http_1 = require("../../../util/http");
const regex_1 = require("../../../util/regex");
const http = new http_1.Http('bazel');
function updateWithNewVersion(content, currentValue, newValue) {
    const replaceFrom = currentValue.replace((0, regex_1.regEx)(/^v/), '');
    const replaceTo = newValue.replace((0, regex_1.regEx)(/^v/), '');
    let newContent = content;
    do {
        newContent = newContent.replace(replaceFrom, replaceTo);
    } while (newContent.includes(replaceFrom));
    return newContent;
}
function extractUrl(flattened) {
    const urlMatch = (0, regex_1.regEx)(/url="(.*?)"/).exec(flattened);
    if (!urlMatch) {
        logger_1.logger.debug('Cannot locate urls in new definition');
        return null;
    }
    return [urlMatch[1]];
}
function extractUrls(content) {
    const flattened = content.replace((0, regex_1.regEx)(/\n/g), '').replace((0, regex_1.regEx)(/\s/g), '');
    const urlsMatch = (0, regex_1.regEx)(/urls?=\[.*?\]/).exec(flattened);
    if (!urlsMatch) {
        return extractUrl(flattened);
    }
    const urls = urlsMatch[0]
        .replace((0, regex_1.regEx)(/urls?=\[/), '')
        .replace((0, regex_1.regEx)(/,?\]$/), '')
        .split(',')
        .map((url) => url.replace((0, regex_1.regEx)(/"/g), ''));
    return urls;
}
async function getHashFromUrl(url) {
    const cacheNamespace = 'url-sha256';
    const cachedResult = await packageCache.get(cacheNamespace, url);
    /* istanbul ignore next line */
    if (cachedResult) {
        return cachedResult;
    }
    try {
        const hash = await hasha_1.default.fromStream(http.stream(url), {
            algorithm: 'sha256',
        });
        const cacheMinutes = 3 * 24 * 60; // 3 days
        await packageCache.set(cacheNamespace, url, hash, cacheMinutes);
        return hash;
    }
    catch (err) /* istanbul ignore next */ {
        return null;
    }
}
async function getHashFromUrls(urls) {
    const hashes = (await Promise.all(urls.map((url) => getHashFromUrl(url)))).filter(Boolean);
    const distinctHashes = [...new Set(hashes)];
    if (!distinctHashes.length) {
        logger_1.logger.debug({ hashes, urls }, 'Could not calculate hash for URLs');
        return null;
    }
    // istanbul ignore if
    if (distinctHashes.length > 1) {
        logger_1.logger.warn({ urls }, 'Found multiple hashes for single def');
    }
    return distinctHashes[0];
}
function setNewHash(content, hash) {
    return content.replace((0, regex_1.regEx)(/(sha256\s*=\s*)"[^"]+"/), `$1"${hash}"`);
}
async function updateDependency({ fileContent, upgrade, }) {
    try {
        logger_1.logger.debug(`bazel.updateDependency(): ${upgrade.newValue || upgrade.newDigest}`);
        let newDef;
        if (upgrade.depType === 'container_pull' && upgrade.managerData?.def) {
            newDef = upgrade.managerData.def
                .replace((0, regex_1.regEx)(/(tag\s*=\s*)"[^"]+"/), `$1"${upgrade.newValue}"`)
                .replace((0, regex_1.regEx)(/(digest\s*=\s*)"[^"]+"/), `$1"${upgrade.newDigest}"`);
        }
        if ((upgrade.depType === 'git_repository' ||
            upgrade.depType === 'go_repository') &&
            upgrade.managerData?.def) {
            newDef = upgrade.managerData.def
                .replace((0, regex_1.regEx)(/(tag\s*=\s*)"[^"]+"/), `$1"${upgrade.newValue}"`)
                .replace((0, regex_1.regEx)(/(commit\s*=\s*)"[^"]+"/), `$1"${upgrade.newDigest}"`);
            if (upgrade.currentDigest && upgrade.updateType !== 'digest') {
                newDef = newDef.replace((0, regex_1.regEx)(/(commit\s*=\s*)"[^"]+".*?\n/), `$1"${upgrade.newDigest}",  # ${upgrade.newValue}\n`);
            }
        }
        else if ((upgrade.depType === 'http_archive' || upgrade.depType === 'http_file') &&
            upgrade.managerData?.def &&
            (upgrade.currentValue || upgrade.currentDigest) &&
            (upgrade.newValue ?? upgrade.newDigest)) {
            newDef = updateWithNewVersion(upgrade.managerData.def, (upgrade.currentValue ?? upgrade.currentDigest), (upgrade.newValue ?? upgrade.newDigest));
            const massages = {
                'bazel-skylib.': 'bazel_skylib-',
                '/bazel-gazelle/releases/download/0': '/bazel-gazelle/releases/download/v0',
                '/bazel-gazelle-0': '/bazel-gazelle-v0',
                '/rules_go/releases/download/0': '/rules_go/releases/download/v0',
                '/rules_go-0': '/rules_go-v0',
            };
            for (const [from, to] of Object.entries(massages)) {
                newDef = newDef.replace(from, to);
            }
            const urls = extractUrls(newDef);
            if (!urls?.length) {
                logger_1.logger.debug({ newDef }, 'urls is empty');
                return null;
            }
            const hash = await getHashFromUrls(urls);
            if (!hash) {
                return null;
            }
            logger_1.logger.debug({ hash }, 'Calculated hash');
            newDef = setNewHash(newDef, hash);
        }
        logger_1.logger.debug({ oldDef: upgrade.managerData?.def, newDef });
        // istanbul ignore if: needs test
        if (!newDef) {
            return null;
        }
        let existingRegExStr = `${upgrade.depType}\\([^\\)]+name\\s*=\\s*"${upgrade.depName}"(.*\\n)+?\\s*\\)`;
        if (newDef.endsWith('\n')) {
            existingRegExStr += '\n';
        }
        const existingDef = (0, regex_1.regEx)(existingRegExStr);
        // istanbul ignore if
        if (!existingDef.test(fileContent)) {
            logger_1.logger.debug('Cannot match existing string');
            return null;
        }
        return fileContent.replace(existingDef, newDef);
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.debug({ err }, 'Error setting new bazel WORKSPACE version');
        return null;
    }
}
exports.updateDependency = updateDependency;
//# sourceMappingURL=update.js.map