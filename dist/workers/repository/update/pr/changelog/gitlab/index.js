"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReleaseList = exports.getReleaseNotesMd = exports.getTags = exports.id = void 0;
const tslib_1 = require("tslib");
const changelog_filename_regex_1 = tslib_1.__importDefault(require("changelog-filename-regex"));
const logger_1 = require("../../../../../../logger");
const gitlab_1 = require("../../../../../../util/http/gitlab");
const url_1 = require("../../../../../../util/url");
exports.id = 'gitlab-changelog';
const http = new gitlab_1.GitlabHttp(exports.id);
async function getTags(endpoint, repository) {
    logger_1.logger.trace('gitlab.getTags()');
    const urlEncodedRepo = encodeURIComponent(repository);
    const url = `${(0, url_1.ensureTrailingSlash)(endpoint)}projects/${urlEncodedRepo}/repository/tags?per_page=100`;
    try {
        const res = await http.getJson(url, {
            paginate: true,
        });
        const tags = res.body;
        if (!tags.length) {
            logger_1.logger.debug({ sourceRepo: repository }, 'repository has no Gitlab tags');
        }
        return tags.map((tag) => tag.name).filter(Boolean);
    }
    catch (err) {
        logger_1.logger.debug({ sourceRepo: repository, err }, 'Failed to fetch Gitlab tags');
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
    logger_1.logger.trace('gitlab.getReleaseNotesMd()');
    const urlEncodedRepo = encodeURIComponent(repository);
    const apiPrefix = `${(0, url_1.ensureTrailingSlash)(apiBaseUrl)}projects/${urlEncodedRepo}/repository/`;
    // https://docs.gitlab.com/13.2/ee/api/repositories.html#list-repository-tree
    const tree = (await http.getJson(`${apiPrefix}tree?per_page=100${sourceDirectory ? `&path=${sourceDirectory}` : ''}`, {
        paginate: true,
    })).body;
    const allFiles = tree.filter((f) => f.type === 'blob');
    let files = [];
    if (!files.length) {
        files = allFiles.filter((f) => changelog_filename_regex_1.default.test(f.name));
    }
    if (!files.length) {
        logger_1.logger.trace('no changelog file found');
        return null;
    }
    const { path: changelogFile, id } = files.shift();
    /* istanbul ignore if */
    if (files.length !== 0) {
        logger_1.logger.debug(`Multiple candidates for changelog file, using ${changelogFile}`);
    }
    // https://docs.gitlab.com/13.2/ee/api/repositories.html#raw-blob-content
    const fileRes = await http.get(`${apiPrefix}blobs/${id}/raw`);
    const changelogMd = fileRes.body + '\n#\n##';
    return { changelogFile, changelogMd };
}
exports.getReleaseNotesMd = getReleaseNotesMd;
async function getReleaseList(apiBaseUrl, repository) {
    logger_1.logger.trace('gitlab.getReleaseNotesMd()');
    const urlEncodedRepo = encodeURIComponent(repository);
    const apiUrl = `${(0, url_1.ensureTrailingSlash)(apiBaseUrl)}projects/${urlEncodedRepo}/releases`;
    const res = await http.getJson(`${apiUrl}?per_page=100`, {
        paginate: true,
    });
    return res.body.map((release) => ({
        url: `${apiUrl}/${release.tag_name}`,
        notesSourceUrl: apiUrl,
        name: release.name,
        body: release.description,
        tag: release.tag_name,
    }));
}
exports.getReleaseList = getReleaseList;
//# sourceMappingURL=index.js.map