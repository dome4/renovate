"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GithubTagsDatasource = void 0;
const tslib_1 = require("tslib");
const logger_1 = require("../../../logger");
const decorator_1 = require("../../../util/cache/package/decorator");
const github_releases_1 = require("../github-releases");
const common_1 = require("../github-releases/common");
const cache_1 = require("./cache");
class GithubTagsDatasource extends github_releases_1.GithubReleasesDatasource {
    constructor() {
        super(GithubTagsDatasource.id);
        this.tagsCache = new cache_1.CacheableGithubTags(this.http);
    }
    async getTagCommit(registryUrl, packageName, tag) {
        let result = null;
        const tagReleases = await this.tagsCache.getItems({
            packageName,
            registryUrl,
        });
        const tagRelease = tagReleases.find(({ version }) => version === tag);
        if (tagRelease) {
            result = tagRelease.hash;
        }
        return result;
    }
    async getCommit(registryUrl, githubRepo) {
        const apiBaseUrl = (0, common_1.getApiBaseUrl)(registryUrl);
        let digest = null;
        try {
            const url = `${apiBaseUrl}repos/${githubRepo}/commits?per_page=1`;
            const res = await this.http.getJson(url);
            digest = res.body[0].sha;
        }
        catch (err) {
            logger_1.logger.debug({ githubRepo: githubRepo, err, registryUrl }, 'Error getting latest commit from GitHub repo');
        }
        return digest;
    }
    /**
     * github.getDigest
     *
     * The `newValue` supplied here should be a valid tag for the docker image.
     *
     * Returns the latest commit hash for the repository.
     */
    getDigest({ packageName: repo, registryUrl }, newValue) {
        return newValue
            ? // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                this.getTagCommit(registryUrl, repo, newValue)
            : // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                this.getCommit(registryUrl, repo);
    }
    async getReleases(config) {
        const tagReleases = await this.tagsCache.getItems(config);
        const tagsResult = {
            sourceUrl: (0, common_1.getSourceUrl)(config.packageName, config.registryUrl),
            releases: tagReleases.map((item) => ({ ...item, gitRef: item.version })),
        };
        try {
            // Fetch additional data from releases endpoint when possible
            const releasesResult = await super.getReleases(config);
            const releaseByVersion = {};
            releasesResult?.releases?.forEach((release) => {
                const { version, ...value } = release;
                releaseByVersion[version] = value;
            });
            const mergedReleases = [];
            tagsResult.releases.forEach((tag) => {
                const release = releaseByVersion[tag.version];
                mergedReleases.push({ ...release, ...tag });
            });
            tagsResult.releases = mergedReleases;
        }
        catch (err) /* istanbul ignore next */ {
            logger_1.logger.debug({ err }, `Error fetching additional info for GitHub tags`);
        }
        return tagsResult;
    }
}
GithubTagsDatasource.id = 'github-tags';
tslib_1.__decorate([
    (0, decorator_1.cache)({
        ttlMinutes: 10,
        namespace: `datasource-${GithubTagsDatasource.id}`,
        key: (registryUrl, githubRepo) => `${registryUrl}:${githubRepo}:commit`,
    })
], GithubTagsDatasource.prototype, "getCommit", null);
exports.GithubTagsDatasource = GithubTagsDatasource;
//# sourceMappingURL=index.js.map