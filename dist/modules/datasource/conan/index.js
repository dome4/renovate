"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConanDatasource = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const js_yaml_1 = require("js-yaml");
const logger_1 = require("../../../logger");
const decorator_1 = require("../../../util/cache/package/decorator");
const github_1 = require("../../../util/http/github");
const url_1 = require("../../../util/url");
const datasource_1 = require("../datasource");
const common_1 = require("./common");
class ConanDatasource extends datasource_1.Datasource {
    constructor(id = ConanDatasource.id) {
        super(id);
        this.defaultRegistryUrls = [common_1.defaultRegistryUrl];
        this.caching = true;
        this.registryStrategy = 'merge';
        this.githubHttp = new github_1.GithubHttp(id);
    }
    async getConanCenterReleases(depName, userAndChannel) {
        if (userAndChannel && userAndChannel !== '@_/_') {
            logger_1.logger.debug({ depName, userAndChannel }, 'User/channel not supported for Conan Center lookups');
            return null;
        }
        const url = `https://api.github.com/repos/conan-io/conan-center-index/contents/recipes/${depName}/config.yml`;
        const res = await this.githubHttp.get(url, {
            headers: { accept: 'application/vnd.github.v3.raw' },
        });
        const doc = (0, js_yaml_1.load)(res.body, {
            json: true,
        });
        return {
            releases: Object.keys(doc?.versions || {}).map((version) => ({
                version,
            })),
        };
    }
    async getReleases({ registryUrl, packageName, }) {
        const depName = packageName.split('/')[0];
        const userAndChannel = '@' + packageName.split('@')[1];
        if (is_1.default.string(registryUrl) &&
            (0, url_1.ensureTrailingSlash)(registryUrl) === common_1.defaultRegistryUrl) {
            return this.getConanCenterReleases(depName, userAndChannel);
        }
        logger_1.logger.trace({ depName, registryUrl }, 'Looking up conan api dependency');
        if (registryUrl) {
            const url = (0, url_1.ensureTrailingSlash)(registryUrl);
            const lookupUrl = (0, url_1.joinUrlParts)(url, `v2/conans/search?q=${depName}`);
            try {
                const rep = await this.http.getJson(lookupUrl);
                const versions = rep?.body;
                if (versions) {
                    logger_1.logger.trace({ lookupUrl }, 'Got conan api result');
                    const dep = { releases: [] };
                    for (const resultString of Object.values(versions.results || {})) {
                        const fromMatch = common_1.conanDatasourceRegex.exec(resultString);
                        if (fromMatch?.groups?.version && fromMatch?.groups?.userChannel) {
                            const version = fromMatch.groups.version;
                            if (fromMatch.groups.userChannel === userAndChannel) {
                                const result = {
                                    version,
                                };
                                dep.releases.push(result);
                            }
                        }
                    }
                    return dep;
                }
            }
            catch (err) {
                this.handleGenericErrors(err);
            }
        }
        return null;
    }
}
ConanDatasource.id = common_1.datasource;
tslib_1.__decorate([
    (0, decorator_1.cache)({
        namespace: `datasource-${common_1.datasource}`,
        key: ({ registryUrl, packageName }) => `${registryUrl}:${packageName}`,
    })
], ConanDatasource.prototype, "getReleases", null);
exports.ConanDatasource = ConanDatasource;
//# sourceMappingURL=index.js.map