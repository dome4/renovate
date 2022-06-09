"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArtifactoryDatasource = void 0;
const tslib_1 = require("tslib");
const logger_1 = require("../../../logger");
const decorator_1 = require("../../../util/cache/package/decorator");
const html_1 = require("../../../util/html");
const http_1 = require("../../../util/http");
const regex_1 = require("../../../util/regex");
const url_1 = require("../../../util/url");
const datasource_1 = require("../datasource");
const common_1 = require("./common");
class ArtifactoryDatasource extends datasource_1.Datasource {
    constructor() {
        super(common_1.datasource);
        this.customRegistrySupport = true;
        this.caching = true;
        this.registryStrategy = 'merge';
    }
    async getReleases({ packageName, registryUrl, }) {
        if (!registryUrl) {
            logger_1.logger.warn({ packageName }, 'artifactory datasource requires custom registryUrl. Skipping datasource');
            return null;
        }
        const url = (0, url_1.joinUrlParts)(registryUrl, packageName);
        const result = {
            releases: [],
        };
        try {
            const response = await this.http.get(url);
            const body = (0, html_1.parse)(response.body, {
                blockTextElements: {
                    script: true,
                    noscript: true,
                    style: true,
                },
            });
            const nodes = body.querySelectorAll('a');
            nodes
                .filter(
            // filter out hyperlink to navigate to parent folder
            (node) => node.innerHTML !== '../' && node.innerHTML !== '..')
                .forEach(
            // extract version and published time for each node
            (node) => {
                const version = node.innerHTML.slice(-1) === '/'
                    ? node.innerHTML.slice(0, -1)
                    : node.innerHTML;
                const published = ArtifactoryDatasource.parseReleaseTimestamp(node.nextSibling?.text);
                const thisRelease = {
                    version,
                    releaseTimestamp: published,
                };
                result.releases.push(thisRelease);
            });
            if (result.releases.length) {
                logger_1.logger.trace({ registryUrl, packageName, versions: result.releases.length }, 'artifactory: Found versions');
            }
            else {
                logger_1.logger.trace({ registryUrl, packageName }, 'artifactory: No versions found');
            }
        }
        catch (err) {
            // istanbul ignore else: not testable with nock
            if (err instanceof http_1.HttpError) {
                if (err.response?.statusCode === 404) {
                    logger_1.logger.warn({ registryUrl, packageName }, 'artifactory: `Not Found` error');
                    return null;
                }
            }
            this.handleGenericErrors(err);
        }
        return result.releases.length ? result : null;
    }
    static parseReleaseTimestamp(rawText) {
        return rawText.trim().replace((0, regex_1.regEx)(/ ?-$/), '') + 'Z';
    }
}
ArtifactoryDatasource.id = common_1.datasource;
tslib_1.__decorate([
    (0, decorator_1.cache)({
        namespace: `datasource-${common_1.datasource}`,
        key: ({ registryUrl, packageName }) => `${registryUrl}:${packageName}`,
    })
], ArtifactoryDatasource.prototype, "getReleases", null);
exports.ArtifactoryDatasource = ArtifactoryDatasource;
//# sourceMappingURL=index.js.map