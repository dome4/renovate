"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitlabPackagesDatasource = void 0;
const tslib_1 = require("tslib");
const decorator_1 = require("../../../util/cache/package/decorator");
const gitlab_1 = require("../../../util/http/gitlab");
const url_1 = require("../../../util/url");
const datasource_1 = require("../datasource");
const common_1 = require("./common");
// Gitlab Packages API: https://docs.gitlab.com/ee/api/packages.html
class GitlabPackagesDatasource extends datasource_1.Datasource {
    constructor() {
        super(common_1.datasource);
        this.caching = true;
        this.customRegistrySupport = true;
        this.defaultRegistryUrls = ['https://gitlab.com'];
        this.http = new gitlab_1.GitlabHttp(common_1.datasource);
    }
    static getGitlabPackageApiUrl(registryUrl, projectName, packageName) {
        const projectNameEncoded = encodeURIComponent(projectName);
        const packageNameEncoded = encodeURIComponent(packageName);
        return (0, url_1.joinUrlParts)(registryUrl, `api/v4/projects`, projectNameEncoded, `packages?package_name=${packageNameEncoded}&per_page=100`);
    }
    async getReleases({ registryUrl, packageName, }) {
        // istanbul ignore if
        if (!registryUrl) {
            return null;
        }
        const [projectPart, packagePart] = packageName.split(':', 2);
        const apiUrl = GitlabPackagesDatasource.getGitlabPackageApiUrl(registryUrl, projectPart, packagePart);
        const result = {
            releases: [],
        };
        let response;
        try {
            response = (await this.http.getJson(apiUrl, { paginate: true })).body;
            result.releases = response
                // Setting the package_name option when calling the GitLab API isn't enough to filter information about other packages
                // because this option is only implemented on GitLab > 12.9 and it only does a fuzzy search.
                .filter((r) => r.name === packagePart)
                .map(({ version, created_at }) => ({
                version,
                releaseTimestamp: created_at,
            }));
        }
        catch (err) {
            this.handleGenericErrors(err);
        }
        return result.releases?.length ? result : null;
    }
}
GitlabPackagesDatasource.id = common_1.datasource;
tslib_1.__decorate([
    (0, decorator_1.cache)({
        namespace: `datasource-${common_1.datasource}`,
        key: ({ registryUrl, packageName }) => `${registryUrl}-${packageName}`,
    })
], GitlabPackagesDatasource.prototype, "getReleases", null);
exports.GitlabPackagesDatasource = GitlabPackagesDatasource;
//# sourceMappingURL=index.js.map