"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRepoUrl = exports.trimTrailingApiPath = exports.smartLinks = void 0;
const tslib_1 = require("tslib");
const constants_1 = require("../../../constants");
const error_messages_1 = require("../../../constants/error-messages");
const logger_1 = require("../../../logger");
const hostRules = tslib_1.__importStar(require("../../../util/host-rules"));
const regex_1 = require("../../../util/regex");
const url_1 = require("../../../util/url");
function smartLinks(body) {
    return body?.replace((0, regex_1.regEx)(/\]\(\.\.\/pull\//g), '](pulls/');
}
exports.smartLinks = smartLinks;
function trimTrailingApiPath(url) {
    return url?.replace((0, regex_1.regEx)(/api\/v1\/?$/g), '');
}
exports.trimTrailingApiPath = trimTrailingApiPath;
function getRepoUrl(repo, gitUrl, endpoint) {
    if (gitUrl === 'ssh') {
        if (!repo.ssh_url) {
            throw new Error(error_messages_1.CONFIG_GIT_URL_UNAVAILABLE);
        }
        logger_1.logger.debug({ url: repo.ssh_url }, `using SSH URL`);
        return repo.ssh_url;
    }
    // Find options for current host and determine Git endpoint
    const opts = hostRules.find({
        hostType: constants_1.PlatformId.Gitea,
        url: endpoint,
    });
    if (gitUrl === 'endpoint') {
        const url = (0, url_1.parseUrl)(endpoint);
        if (!url) {
            throw new Error(error_messages_1.CONFIG_GIT_URL_UNAVAILABLE);
        }
        url.protocol = url.protocol?.slice(0, -1) ?? 'https';
        url.username = opts.token ?? '';
        url.pathname = `${url.pathname}${repo.full_name}.git`;
        logger_1.logger.debug({ url: url.toString() }, 'using URL based on configured endpoint');
        return url.toString();
    }
    if (!repo.clone_url) {
        throw new Error(error_messages_1.CONFIG_GIT_URL_UNAVAILABLE);
    }
    logger_1.logger.debug({ url: repo.clone_url }, `using HTTP URL`);
    const repoUrl = (0, url_1.parseUrl)(repo.clone_url);
    if (!repoUrl) {
        throw new Error(error_messages_1.CONFIG_GIT_URL_UNAVAILABLE);
    }
    repoUrl.username = opts.token ?? '';
    return repoUrl.toString();
}
exports.getRepoUrl = getRepoUrl;
//# sourceMappingURL=utils.js.map