"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitlabTagsDatasource = void 0;
const tslib_1 = require("tslib");
const logger_1 = require("../../../logger");
const decorator_1 = require("../../../util/cache/package/decorator");
const gitlab_1 = require("../../../util/http/gitlab");
const url_1 = require("../../../util/url");
const datasource_1 = require("../datasource");
const util_1 = require("./util");
class GitlabTagsDatasource extends datasource_1.Datasource {
    constructor() {
        super(GitlabTagsDatasource.id);
        this.defaultRegistryUrls = [util_1.defaultRegistryUrl];
        this.http = new gitlab_1.GitlabHttp(GitlabTagsDatasource.id);
    }
    async getReleases({ registryUrl, packageName: repo, }) {
        const depHost = (0, util_1.getDepHost)(registryUrl);
        const urlEncodedRepo = encodeURIComponent(repo);
        // tag
        const url = (0, url_1.joinUrlParts)(depHost, `api/v4/projects`, urlEncodedRepo, `repository/tags?per_page=100`);
        const gitlabTags = (await this.http.getJson(url, {
            paginate: true,
        })).body;
        const dependency = {
            sourceUrl: (0, util_1.getSourceUrl)(repo, registryUrl),
            releases: [],
        };
        dependency.releases = gitlabTags.map(({ name, commit }) => ({
            version: name,
            gitRef: name,
            releaseTimestamp: commit?.created_at,
        }));
        return dependency;
    }
    /**
     * gitlab.getDigest
     *
     * Returs the latest commit hash of the repository.
     */
    async getDigest({ packageName: repo, registryUrl }, newValue) {
        const depHost = (0, util_1.getDepHost)(registryUrl);
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        const urlEncodedRepo = encodeURIComponent(repo);
        let digest = null;
        try {
            if (newValue) {
                const url = (0, url_1.joinUrlParts)(depHost, `api/v4/projects`, urlEncodedRepo, `repository/commits/`, newValue);
                const gitlabCommits = await this.http.getJson(url);
                digest = gitlabCommits.body.id;
            }
            else {
                const url = (0, url_1.joinUrlParts)(depHost, `api/v4/projects`, urlEncodedRepo, `repository/commits?per_page=1`);
                const gitlabCommits = await this.http.getJson(url);
                digest = gitlabCommits.body[0].id;
            }
        }
        catch (err) {
            logger_1.logger.debug({ gitlabRepo: repo, err, registryUrl }, 'Error getting latest commit from Gitlab repo');
        }
        if (!digest) {
            return null;
        }
        return digest;
    }
}
GitlabTagsDatasource.id = 'gitlab-tags';
tslib_1.__decorate([
    (0, decorator_1.cache)({
        namespace: `datasource-${GitlabTagsDatasource.id}`,
        key: ({ registryUrl, packageName }) => `${(0, util_1.getDepHost)(registryUrl)}:${packageName}`,
    })
], GitlabTagsDatasource.prototype, "getReleases", null);
tslib_1.__decorate([
    (0, decorator_1.cache)({
        namespace: `datasource-${GitlabTagsDatasource.id}-commit`,
        key: ({ registryUrl, packageName }) => `${(0, util_1.getDepHost)(registryUrl)}:${packageName}`,
    })
], GitlabTagsDatasource.prototype, "getDigest", null);
exports.GitlabTagsDatasource = GitlabTagsDatasource;
//# sourceMappingURL=index.js.map