"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitlabReleasesDatasource = void 0;
const tslib_1 = require("tslib");
const decorator_1 = require("../../../util/cache/package/decorator");
const gitlab_1 = require("../../../util/http/gitlab");
const datasource_1 = require("../datasource");
class GitlabReleasesDatasource extends datasource_1.Datasource {
    constructor() {
        super(GitlabReleasesDatasource.id);
        this.defaultRegistryUrls = ['https://gitlab.com'];
        this.http = new gitlab_1.GitlabHttp(GitlabReleasesDatasource.id);
    }
    async getReleases({ registryUrl, packageName, }) {
        // istanbul ignore if
        if (!registryUrl) {
            return null;
        }
        const urlEncodedRepo = encodeURIComponent(packageName);
        const apiUrl = `${registryUrl}/api/v4/projects/${urlEncodedRepo}/releases`;
        try {
            const gitlabReleasesResponse = (await this.http.getJson(apiUrl)).body;
            return {
                sourceUrl: `${registryUrl}/${packageName}`,
                releases: gitlabReleasesResponse.map(({ tag_name, released_at }) => {
                    const release = {
                        registryUrl,
                        gitRef: tag_name,
                        version: tag_name,
                        releaseTimestamp: released_at,
                    };
                    return release;
                }),
            };
        }
        catch (e) {
            this.handleGenericErrors(e);
        }
        /* istanbul ignore next */
        return null;
    }
}
GitlabReleasesDatasource.id = 'gitlab-releases';
GitlabReleasesDatasource.registryStrategy = 'first';
tslib_1.__decorate([
    (0, decorator_1.cache)({
        namespace: `datasource-${GitlabReleasesDatasource.id}`,
        key: ({ registryUrl, packageName }) => `${registryUrl}/${packageName}`,
    })
], GitlabReleasesDatasource.prototype, "getReleases", null);
exports.GitlabReleasesDatasource = GitlabReleasesDatasource;
//# sourceMappingURL=index.js.map