"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RubyVersionDatasource = void 0;
const tslib_1 = require("tslib");
const external_host_error_1 = require("../../../types/errors/external-host-error");
const decorator_1 = require("../../../util/cache/package/decorator");
const html_1 = require("../../../util/html");
const ruby_1 = require("../../versioning/ruby");
const datasource_1 = require("../datasource");
class RubyVersionDatasource extends datasource_1.Datasource {
    constructor() {
        super(RubyVersionDatasource.id);
        this.defaultRegistryUrls = ['https://www.ruby-lang.org/'];
        this.customRegistrySupport = false;
        this.defaultVersioning = ruby_1.id;
    }
    async getReleases({ registryUrl, }) {
        const res = {
            homepage: 'https://www.ruby-lang.org',
            sourceUrl: 'https://github.com/ruby/ruby',
            releases: [],
        };
        const rubyVersionsUrl = `${registryUrl}en/downloads/releases/`;
        try {
            const response = await this.http.get(rubyVersionsUrl);
            const root = (0, html_1.parse)(response.body);
            const rows = root.querySelector('.release-list')?.querySelectorAll('tr') ?? [];
            rows.forEach((row) => {
                const tds = row.querySelectorAll('td');
                const columns = [];
                tds.forEach((td) => columns.push(td.innerHTML));
                if (columns.length) {
                    const version = columns[0].replace('Ruby ', '');
                    if ((0, ruby_1.isVersion)(version)) {
                        const releaseTimestamp = columns[1];
                        const changelogUrl = columns[2]
                            .replace('<a href="', 'https://www.ruby-lang.org')
                            .replace('">more...</a>', '');
                        res.releases.push({ version, releaseTimestamp, changelogUrl });
                    }
                }
            });
            if (!res.releases.length) {
                throw new Error('Missing ruby releases');
            }
        }
        catch (err) {
            this.handleGenericErrors(err);
        }
        return res;
    }
    handleSpecificErrors(err) {
        throw new external_host_error_1.ExternalHostError(err);
    }
}
RubyVersionDatasource.id = 'ruby-version';
tslib_1.__decorate([
    (0, decorator_1.cache)({ namespace: `datasource-${RubyVersionDatasource.id}`, key: 'all' })
], RubyVersionDatasource.prototype, "getReleases", null);
exports.RubyVersionDatasource = RubyVersionDatasource;
//# sourceMappingURL=index.js.map