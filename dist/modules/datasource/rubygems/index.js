"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RubyGemsDatasource = void 0;
const tslib_1 = require("tslib");
const decorator_1 = require("../../../util/cache/package/decorator");
const url_1 = require("../../../util/url");
const rubyVersioning = tslib_1.__importStar(require("../../versioning/ruby"));
const datasource_1 = require("../datasource");
const get_1 = require("./get");
const get_rubygems_org_1 = require("./get-rubygems-org");
class RubyGemsDatasource extends datasource_1.Datasource {
    constructor() {
        super(RubyGemsDatasource.id);
        this.defaultRegistryUrls = ['https://rubygems.org'];
        this.defaultVersioning = rubyVersioning.id;
        this.registryStrategy = 'hunt';
        this.rubyGemsOrgDatasource = new get_rubygems_org_1.RubyGemsOrgDatasource(RubyGemsDatasource.id);
        this.internalRubyGemsDatasource = new get_1.InternalRubyGemsDatasource(RubyGemsDatasource.id);
    }
    getReleases({ packageName, registryUrl, }) {
        if ((0, url_1.parseUrl)(registryUrl)?.hostname === 'rubygems.org') {
            return this.rubyGemsOrgDatasource.getReleases({ packageName });
        }
        return this.internalRubyGemsDatasource.getReleases({
            packageName,
            registryUrl,
        });
    }
}
RubyGemsDatasource.id = 'rubygems';
tslib_1.__decorate([
    (0, decorator_1.cache)({
        namespace: `datasource-${RubyGemsDatasource.id}`,
        key: ({ registryUrl, packageName }) => `${registryUrl}/${packageName}`,
    })
], RubyGemsDatasource.prototype, "getReleases", null);
exports.RubyGemsDatasource = RubyGemsDatasource;
//# sourceMappingURL=index.js.map