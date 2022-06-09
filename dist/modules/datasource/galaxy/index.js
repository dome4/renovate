"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GalaxyDatasource = void 0;
const tslib_1 = require("tslib");
const logger_1 = require("../../../logger");
const decorator_1 = require("../../../util/cache/package/decorator");
const datasource_1 = require("../datasource");
class GalaxyDatasource extends datasource_1.Datasource {
    constructor() {
        super(GalaxyDatasource.id);
        this.customRegistrySupport = false;
        this.defaultRegistryUrls = ['https://galaxy.ansible.com/'];
    }
    async getReleases({ packageName, registryUrl, }) {
        const lookUp = packageName.split('.');
        const userName = lookUp[0];
        const projectName = lookUp[1];
        const galaxyAPIUrl = registryUrl +
            'api/v1/roles/?owner__username=' +
            userName +
            '&name=' +
            projectName;
        const galaxyProjectUrl = registryUrl + userName + '/' + projectName;
        let raw = null;
        try {
            raw = await this.http.getJson(galaxyAPIUrl);
        }
        catch (err) {
            this.handleGenericErrors(err);
        }
        const body = raw?.body;
        if (!body) {
            logger_1.logger.warn({ dependency: packageName }, `Received invalid data from ${galaxyAPIUrl}`);
            return null;
        }
        // istanbul ignore if
        if (body.results.length > 1) {
            logger_1.logger.warn({ dependency: packageName }, `Received multiple results from ${galaxyAPIUrl}`);
            return null;
        }
        if (body.results.length === 0) {
            logger_1.logger.info({ dependency: packageName }, `Received no results from ${galaxyAPIUrl}`);
            return null;
        }
        const resultObject = body.results[0];
        const versions = resultObject.summary_fields.versions;
        const result = {
            releases: [],
        };
        result.dependencyUrl = galaxyProjectUrl;
        const { github_user: user, github_repo: repo } = resultObject;
        if (typeof user === 'string' && typeof repo === 'string') {
            result.sourceUrl = `https://github.com/${user}/${repo}`;
        }
        result.releases = versions.map((version) => {
            const release = {
                version: version.name,
                releaseTimestamp: version.release_date,
            };
            return release;
        });
        return result;
    }
}
GalaxyDatasource.id = 'galaxy';
tslib_1.__decorate([
    (0, decorator_1.cache)({
        namespace: 'datasource-galaxy',
        key: (getReleasesConfig) => getReleasesConfig.packageName,
    })
], GalaxyDatasource.prototype, "getReleases", null);
exports.GalaxyDatasource = GalaxyDatasource;
//# sourceMappingURL=index.js.map