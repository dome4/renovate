"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdoptiumJavaDatasource = void 0;
const tslib_1 = require("tslib");
const logger_1 = require("../../../logger");
const external_host_error_1 = require("../../../types/errors/external-host-error");
const decorator_1 = require("../../../util/cache/package/decorator");
const http_1 = require("../../../util/http");
const datasource_1 = require("../datasource");
const common_1 = require("./common");
class AdoptiumJavaDatasource extends datasource_1.Datasource {
    constructor() {
        super(common_1.datasource);
        this.customRegistrySupport = false;
        this.defaultRegistryUrls = [common_1.defaultRegistryUrl];
        this.caching = true;
    }
    async getPageReleases(url, page) {
        const pgUrl = `${url}&page=${page}`;
        try {
            const pgRes = await this.http.getJson(pgUrl);
            return (pgRes?.body?.versions?.map(({ semver }) => ({
                version: semver,
            })) ?? null);
        }
        catch (err) {
            if (page !== 0 &&
                err instanceof http_1.HttpError &&
                err.response?.statusCode === 404) {
                // No more pages
                return null;
            }
            throw err;
        }
    }
    async getReleases({ registryUrl, packageName, }) {
        const imageType = (0, common_1.getImageType)(packageName);
        logger_1.logger.trace({ registryUrl, packageName, imageType }, 'fetching java release');
        const url = `${registryUrl}v3/info/release_versions?page_size=${common_1.pageSize}&image_type=${imageType}&project=jdk&release_type=ga&sort_method=DATE&sort_order=DESC&vendor=adoptium`;
        const result = {
            homepage: 'https://adoptium.net',
            releases: [],
        };
        try {
            let page = 0;
            let releases = await this.getPageReleases(url, page);
            while (releases) {
                result.releases.push(...releases);
                if (releases.length !== common_1.pageSize || page >= 50) {
                    break;
                }
                page += 1;
                releases = await this.getPageReleases(url, page);
            }
        }
        catch (err) {
            // istanbul ignore else: not testable with nock
            if (err instanceof http_1.HttpError) {
                if (err.response?.statusCode !== 404) {
                    throw new external_host_error_1.ExternalHostError(err);
                }
            }
            this.handleGenericErrors(err);
        }
        return result.releases.length ? result : null;
    }
}
AdoptiumJavaDatasource.id = common_1.datasource;
tslib_1.__decorate([
    (0, decorator_1.cache)({
        namespace: `datasource-${common_1.datasource}`,
        key: ({ registryUrl, packageName }) => `${registryUrl}:${(0, common_1.getImageType)(packageName)}`,
    })
], AdoptiumJavaDatasource.prototype, "getReleases", null);
exports.AdoptiumJavaDatasource = AdoptiumJavaDatasource;
//# sourceMappingURL=index.js.map