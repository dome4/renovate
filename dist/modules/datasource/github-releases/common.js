"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSourceUrl = exports.getApiBaseUrl = exports.getSourceUrlBase = void 0;
const url_1 = require("../../../util/url");
const defaultSourceUrlBase = 'https://github.com/';
const defaultApiBaseUrl = 'https://api.github.com/';
function getSourceUrlBase(registryUrl) {
    // default to GitHub.com if no GHE host is specified.
    return (0, url_1.ensureTrailingSlash)(registryUrl ?? defaultSourceUrlBase);
}
exports.getSourceUrlBase = getSourceUrlBase;
function getApiBaseUrl(registryUrl) {
    const sourceUrlBase = getSourceUrlBase(registryUrl);
    return [defaultSourceUrlBase, defaultApiBaseUrl].includes(sourceUrlBase)
        ? defaultApiBaseUrl
        : `${sourceUrlBase}api/v3/`;
}
exports.getApiBaseUrl = getApiBaseUrl;
function getSourceUrl(packageName, registryUrl) {
    const sourceUrlBase = getSourceUrlBase(registryUrl);
    return `${sourceUrlBase}${packageName}`;
}
exports.getSourceUrl = getSourceUrl;
//# sourceMappingURL=common.js.map