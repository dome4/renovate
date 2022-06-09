"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CondaDatasource = void 0;
const tslib_1 = require("tslib");
const logger_1 = require("../../../logger");
const external_host_error_1 = require("../../../types/errors/external-host-error");
const decorator_1 = require("../../../util/cache/package/decorator");
const http_1 = require("../../../util/http");
const datasource_1 = require("../datasource");
const common_1 = require("./common");
class CondaDatasource extends datasource_1.Datasource {
    constructor() {
        super(common_1.datasource);
        this.customRegistrySupport = false;
        this.defaultRegistryUrls = [common_1.defaultRegistryUrl];
        this.caching = true;
    }
    async getReleases({ registryUrl, packageName, }) {
        logger_1.logger.trace({ registryUrl, packageName }, 'fetching conda package');
        const url = `${registryUrl}${packageName}`;
        const result = {
            releases: [],
        };
        let response;
        try {
            response = await this.http.getJson(url);
            result.homepage = response.body.html_url;
            result.sourceUrl = response.body.dev_url;
            response.body.versions.forEach((version) => {
                const thisRelease = {
                    version: version,
                };
                result.releases.push(thisRelease);
            });
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
CondaDatasource.id = common_1.datasource;
tslib_1.__decorate([
    (0, decorator_1.cache)({
        namespace: `datasource-${common_1.datasource}`,
        key: ({ registryUrl, packageName }) => `${registryUrl}:${packageName}`,
    })
], CondaDatasource.prototype, "getReleases", null);
exports.CondaDatasource = CondaDatasource;
//# sourceMappingURL=index.js.map