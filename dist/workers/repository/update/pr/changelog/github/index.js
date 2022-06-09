"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReleaseList = exports.getReleaseNotesMd = exports.getTags = exports.id = void 0;
const tslib_1 = require("tslib");
const changelog_filename_regex_1 = tslib_1.__importDefault(require("changelog-filename-regex"));
const logger_1 = require("../../../../../../logger");
const cache_1 = require("../../../../../../modules/datasource/github-releases/cache");
const cache_2 = require("../../../../../../modules/datasource/github-tags/cache");
const github_1 = require("../../../../../../util/http/github");
const string_1 = require("../../../../../../util/string");
const url_1 = require("../../../../../../util/url");
exports.id = 'github-changelog';
const http = new github_1.GithubHttp(exports.id);
const tagsCache = new cache_2.CacheableGithubTags(http);
const releasesCache = new cache_1.CacheableGithubReleases(http);
async function getTags(endpoint, repository) {
    logger_1.logger.trace('github.getTags()');
    try {
        const tags = await tagsCache.getItems({
            registryUrl: endpoint,
            packageName: repository,
        });
        // istanbul ignore if
        if (!tags.length) {
            logger_1.logger.debug({ repository }, 'repository has no Github tags');
        }
        return tags.map(({ version }) => version).filter(Boolean);
    }
    catch (err) {
        logger_1.logger.debug({ sourceRepo: repository, err }, 'Failed to fetch Github tags');
        // istanbul ignore if
        if (err.message?.includes('Bad credentials')) {
            logger_1.logger.warn('Bad credentials triggering tag fail lookup in changelog');
            throw err;
        }
        return [];
    }
}
exports.getTags = getTags;
async function getReleaseNotesMd(repository, apiBaseUrl, sourceDirectory) {
    logger_1.logger.trace('github.getReleaseNotesMd()');
    const apiPrefix = `${(0, url_1.ensureTrailingSlash)(apiBaseUrl)}repos/${repository}`;
    const { default_branch: defaultBranch = 'HEAD' } = (await http.getJson(apiPrefix)).body;
    // https://docs.github.com/en/rest/reference/git#get-a-tree
    const res = await http.getJson(`${apiPrefix}/git/trees/${defaultBranch}${sourceDirectory ? '?recursive=1' : ''}`);
    // istanbul ignore if
    if (res.body.truncated) {
        logger_1.logger.debug({ repository }, 'Git tree truncated');
    }
    const allFiles = res.body.tree.filter((f) => f.type === 'blob');
    let files = [];
    if (sourceDirectory?.length) {
        files = allFiles
            .filter((f) => f.path.startsWith(sourceDirectory))
            .filter((f) => changelog_filename_regex_1.default.test(f.path.replace((0, url_1.ensureTrailingSlash)(sourceDirectory), '')));
    }
    if (!files.length) {
        files = allFiles.filter((f) => changelog_filename_regex_1.default.test(f.path));
    }
    if (!files.length) {
        logger_1.logger.trace('no changelog file found');
        return null;
    }
    const { path: changelogFile, sha } = files.shift();
    /* istanbul ignore if */
    if (files.length !== 0) {
        logger_1.logger.debug(`Multiple candidates for changelog file, using ${changelogFile}`);
    }
    // https://docs.github.com/en/rest/reference/git#get-a-blob
    const fileRes = await http.getJson(`${apiPrefix}/git/blobs/${sha}`);
    const changelogMd = (0, string_1.fromBase64)(fileRes.body.content) + '\n#\n##';
    return { changelogFile, changelogMd };
}
exports.getReleaseNotesMd = getReleaseNotesMd;
async function getReleaseList(apiBaseUrl, repository) {
    logger_1.logger.trace('github.getReleaseList()');
    const notesSourceUrl = `${(0, url_1.ensureTrailingSlash)(apiBaseUrl)}repos/${repository}/releases`;
    const items = await releasesCache.getItems({
        registryUrl: apiBaseUrl,
        packageName: repository,
    });
    return items.map(({ url, id, version: tag, name, description: body }) => ({
        url,
        notesSourceUrl,
        id,
        tag,
        name,
        body,
    }));
}
exports.getReleaseList = getReleaseList;
//# sourceMappingURL=index.js.map