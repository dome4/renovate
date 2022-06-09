"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CdnJsDatasource = void 0;
const external_host_error_1 = require("../../../types/errors/external-host-error");
const datasource_1 = require("../datasource");
class CdnJsDatasource extends datasource_1.Datasource {
    constructor() {
        super(CdnJsDatasource.id);
        this.customRegistrySupport = false;
        this.defaultRegistryUrls = ['https://api.cdnjs.com/'];
        this.caching = true;
    }
    // this.handleErrors will always throw
    async getReleases({ packageName, registryUrl, }) {
        // Each library contains multiple assets, so we cache at the library level instead of per-asset
        const library = packageName.split('/')[0];
        const url = `${registryUrl}libraries/${library}?fields=homepage,repository,assets`;
        let result = null;
        try {
            const { assets, homepage, repository } = (await this.http.getJson(url)).body;
            if (!assets) {
                return null;
            }
            const assetName = packageName.replace(`${library}/`, '');
            const releases = assets
                .filter(({ files }) => files.includes(assetName))
                .map(({ version, sri }) => ({ version, newDigest: sri?.[assetName] }));
            result = { releases };
            if (homepage) {
                result.homepage = homepage;
            }
            if (repository?.url) {
                result.sourceUrl = repository.url;
            }
        }
        catch (err) {
            if (err.statusCode !== 404) {
                throw new external_host_error_1.ExternalHostError(err);
            }
            this.handleGenericErrors(err);
        }
        return result;
    }
}
exports.CdnJsDatasource = CdnJsDatasource;
CdnJsDatasource.id = 'cdnjs';
//# sourceMappingURL=index.js.map