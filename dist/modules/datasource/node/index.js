"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeDatasource = void 0;
const tslib_1 = require("tslib");
const decorator_1 = require("../../../util/cache/package/decorator");
const url_1 = require("../../../util/url");
const node_1 = require("../../versioning/node");
const datasource_1 = require("../datasource");
const common_1 = require("./common");
class NodeDatasource extends datasource_1.Datasource {
    constructor() {
        super(common_1.datasource);
        this.customRegistrySupport = false;
        this.defaultRegistryUrls = [common_1.defaultRegistryUrl];
        this.defaultVersioning = node_1.id;
        this.caching = true;
    }
    async getReleases({ registryUrl, }) {
        // istanbul ignore if
        if (!registryUrl) {
            return null;
        }
        const result = {
            homepage: 'https://nodejs.org',
            sourceUrl: 'https://github.com/nodejs/node',
            registryUrl,
            releases: [],
        };
        try {
            const resp = (await this.http.getJson((0, url_1.joinUrlParts)(registryUrl, 'index.json'))).body;
            result.releases.push(...resp.map(({ version, date, lts }) => ({
                version,
                releaseTimestamp: date,
                isStable: lts !== false,
            })));
        }
        catch (err) {
            this.handleGenericErrors(err);
        }
        return result.releases.length ? result : null;
    }
}
NodeDatasource.id = common_1.datasource;
tslib_1.__decorate([
    (0, decorator_1.cache)({
        namespace: `datasource-${common_1.datasource}`,
        key: ({ registryUrl }) => `${registryUrl}`,
    })
], NodeDatasource.prototype, "getReleases", null);
exports.NodeDatasource = NodeDatasource;
//# sourceMappingURL=index.js.map