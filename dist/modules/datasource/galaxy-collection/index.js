"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GalaxyCollectionDatasource = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const p_map_1 = tslib_1.__importDefault(require("p-map"));
const logger_1 = require("../../../logger");
const decorator_1 = require("../../../util/cache/package/decorator");
const datasource_1 = require("../datasource");
class GalaxyCollectionDatasource extends datasource_1.Datasource {
    constructor() {
        super(GalaxyCollectionDatasource.id);
        this.customRegistrySupport = false;
        this.defaultRegistryUrls = ['https://galaxy.ansible.com/'];
    }
    async getReleases({ packageName, registryUrl, }) {
        const [namespace, projectName] = packageName.split('.');
        const baseUrl = `${registryUrl}api/v2/collections/${namespace}/${projectName}/`;
        let baseUrlResponse;
        try {
            baseUrlResponse = await this.http.getJson(baseUrl);
        }
        catch (err) {
            this.handleGenericErrors(err);
        }
        if (!baseUrlResponse || !baseUrlResponse.body) {
            logger_1.logger.warn({ dependency: packageName }, `Received invalid data from ${baseUrl}`);
            return null;
        }
        const baseProject = baseUrlResponse.body;
        const versionsUrl = `${baseUrl}versions/`;
        let versionsUrlResponse;
        try {
            versionsUrlResponse = await this.http.getJson(versionsUrl);
        }
        catch (err) {
            this.handleGenericErrors(err);
        }
        const versionsProject = versionsUrlResponse.body;
        const releases = versionsProject.results.map((value) => {
            const release = {
                version: value.version,
                isDeprecated: baseProject.deprecated,
            };
            return release;
        });
        let newestVersionDetails;
        // asynchronously get release details
        const enrichedReleases = await (0, p_map_1.default)(releases, (basicRelease) => this.http
            .getJson(`${versionsUrl}${basicRelease.version}/`)
            .then((versionDetailResultResponse) => versionDetailResultResponse.body)
            .then((versionDetails) => {
            try {
                const release = {
                    version: basicRelease.version,
                    isDeprecated: basicRelease.isDeprecated,
                    downloadUrl: versionDetails.download_url,
                    newDigest: versionDetails.artifact.sha256,
                    dependencies: versionDetails.metadata.dependencies,
                };
                // save details of the newest release for use on the ReleaseResult object
                if (basicRelease.version === baseProject.latest_version.version) {
                    newestVersionDetails = versionDetails;
                }
                return release;
            }
            catch (err) {
                logger_1.logger.warn({ dependency: packageName, err }, `Received invalid data from ${versionsUrl}${basicRelease.version}/`);
                return null;
            }
        }), { concurrency: 5 } // allow 5 requests at maximum in parallel
        );
        // filter failed versions
        const filteredReleases = enrichedReleases.filter(is_1.default.truthy);
        // extract base information which are only provided on the release from the newest release
        const result = {
            releases: filteredReleases,
            sourceUrl: newestVersionDetails?.metadata.repository,
            homepage: newestVersionDetails?.metadata.homepage,
            tags: newestVersionDetails?.metadata.tags,
        };
        return result;
    }
}
GalaxyCollectionDatasource.id = 'galaxy-collection';
tslib_1.__decorate([
    (0, decorator_1.cache)({
        namespace: `datasource-${GalaxyCollectionDatasource.id}`,
        key: ({ packageName }) => packageName,
    })
], GalaxyCollectionDatasource.prototype, "getReleases", null);
exports.GalaxyCollectionDatasource = GalaxyCollectionDatasource;
//# sourceMappingURL=index.js.map