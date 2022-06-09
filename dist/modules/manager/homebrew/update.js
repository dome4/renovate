"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDependency = void 0;
const tslib_1 = require("tslib");
const hasha_1 = tslib_1.__importDefault(require("hasha"));
const semver_1 = tslib_1.__importDefault(require("semver"));
const logger_1 = require("../../../logger");
const http_1 = require("../../../util/http");
const extract_1 = require("./extract");
const util_1 = require("./util");
const http = new http_1.Http('homebrew');
function replaceUrl(idx, content, oldUrl, newUrl) {
    let i = idx;
    i += 'url'.length;
    i = (0, util_1.skip)(i, content, (c) => (0, util_1.isSpace)(c));
    const chr = content[i];
    if (chr !== '"' && chr !== "'") {
        return null;
    }
    i += 1;
    const newContent = content.substring(0, i) + content.substring(i).replace(oldUrl, newUrl);
    return newContent;
}
function getUrlTestContent(content, oldUrl, newUrl) {
    const urlRegExp = /(^|\s)url(\s)/;
    const cleanContent = (0, util_1.removeComments)(content);
    let j = cleanContent.search(urlRegExp);
    if ((0, util_1.isSpace)(cleanContent[j])) {
        j += 1;
    }
    const testContent = replaceUrl(j, cleanContent, oldUrl, newUrl);
    return testContent;
}
function updateUrl(content, oldUrl, newUrl) {
    const urlRegExp = /(^|\s)url(\s)/;
    let i = content.search(urlRegExp);
    if (i === -1) {
        return null;
    }
    if ((0, util_1.isSpace)(content[i])) {
        i += 1;
    }
    let newContent = replaceUrl(i, content, oldUrl, newUrl);
    const testContent = getUrlTestContent(content, oldUrl, newUrl);
    if (!newContent || !testContent) {
        return null;
    }
    while (newContent && (0, util_1.removeComments)(newContent) !== testContent) {
        i += 'url'.length;
        i += content.substring(i).search(urlRegExp);
        if ((0, util_1.isSpace)(content[i])) {
            i += 1;
        }
        newContent = replaceUrl(i, content, oldUrl, newUrl);
    }
    return newContent;
}
function replaceSha256(idx, content, oldSha256, newSha256) {
    let i = idx;
    i += 'sha256'.length;
    i = (0, util_1.skip)(i, content, (c) => (0, util_1.isSpace)(c));
    const chr = content[i];
    if (chr !== '"' && chr !== "'") {
        return null;
    }
    i += 1;
    const newContent = content.substring(0, i) +
        content.substring(i).replace(oldSha256, newSha256);
    return newContent;
}
function getSha256TestContent(content, oldSha256, newSha256) {
    const sha256RegExp = /(^|\s)sha256(\s)/;
    const cleanContent = (0, util_1.removeComments)(content);
    let j = cleanContent.search(sha256RegExp);
    if ((0, util_1.isSpace)(cleanContent[j])) {
        j += 1;
    }
    const testContent = replaceSha256(j, cleanContent, oldSha256, newSha256);
    return testContent;
}
function updateSha256(content, oldSha256, newSha256) {
    const sha256RegExp = /(^|\s)sha256(\s)/;
    let i = content.search(sha256RegExp);
    if (i === -1) {
        return null;
    }
    if ((0, util_1.isSpace)(content[i])) {
        i += 1;
    }
    let newContent = replaceSha256(i, content, oldSha256, newSha256);
    const testContent = getSha256TestContent(content, oldSha256, newSha256);
    if (!newContent || !testContent) {
        return null;
    }
    while (newContent && (0, util_1.removeComments)(newContent) !== testContent) {
        i += 'sha256'.length;
        i += content.substring(i).search(sha256RegExp);
        if ((0, util_1.isSpace)(content[i])) {
            i += 1;
        }
        newContent = replaceSha256(i, content, oldSha256, newSha256);
    }
    return newContent;
}
// TODO: Refactor (#9591)
async function updateDependency({ fileContent, upgrade, }) {
    logger_1.logger.trace('updateDependency()');
    /*
      1. Update url field 2. Update sha256 field
     */
    let newUrl;
    // Example urls:
    // "https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz"
    // "https://github.com/aide/aide/releases/download/v0.16.1/aide-0.16.1.tar.gz"
    const oldParsedUrlPath = (0, extract_1.parseUrlPath)(upgrade.managerData?.url);
    if (!oldParsedUrlPath || !upgrade.managerData) {
        logger_1.logger.debug(`Failed to update - upgrade.managerData.url is invalid ${upgrade.depName}`);
        return fileContent;
    }
    let newSha256;
    try {
        const ownerName = String(upgrade.managerData.ownerName);
        const repoName = String(upgrade.managerData.repoName);
        newUrl = `https://github.com/${ownerName}/${repoName}/releases/download/${upgrade.newValue}/${repoName}-${String(semver_1.default.coerce(upgrade.newValue))}.tar.gz`;
        newSha256 = await hasha_1.default.fromStream(http.stream(newUrl), {
            algorithm: 'sha256',
        });
    }
    catch (errOuter) {
        logger_1.logger.debug(`Failed to download release download for ${upgrade.depName} - trying archive instead`);
        try {
            const ownerName = String(upgrade.managerData.ownerName);
            const repoName = String(upgrade.managerData.repoName);
            newUrl = `https://github.com/${ownerName}/${repoName}/archive/${upgrade.newValue}.tar.gz`;
            newSha256 = await hasha_1.default.fromStream(http.stream(newUrl), {
                algorithm: 'sha256',
            });
        }
        catch (errInner) {
            logger_1.logger.debug(`Failed to download archive download for ${upgrade.depName} - update failed`);
            return fileContent;
        }
    }
    // istanbul ignore next
    if (!newSha256) {
        logger_1.logger.debug(`Failed to generate new sha256 for ${upgrade.depName} - update failed`);
        return fileContent;
    }
    const newParsedUrlPath = (0, extract_1.parseUrlPath)(newUrl);
    if (!newParsedUrlPath) {
        logger_1.logger.debug(`Failed to update url for dependency ${upgrade.depName}`);
        return fileContent;
    }
    if (upgrade.newValue !== newParsedUrlPath.currentValue) {
        logger_1.logger.debug(`Failed to update url for dependency ${upgrade.depName}`);
        return fileContent;
    }
    let newContent = updateUrl(fileContent, upgrade.managerData.url, newUrl);
    if (!newContent) {
        logger_1.logger.debug(`Failed to update url for dependency ${upgrade.depName}`);
        return fileContent;
    }
    newContent = updateSha256(newContent, upgrade.managerData.sha256, newSha256);
    if (!newContent) {
        logger_1.logger.debug(`Failed to update sha256 for dependency ${upgrade.depName}`);
        return fileContent;
    }
    return newContent;
}
exports.updateDependency = updateDependency;
//# sourceMappingURL=update.js.map