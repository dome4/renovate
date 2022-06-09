"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JenkinsPluginsDatasource = void 0;
const tslib_1 = require("tslib");
const logger_1 = require("../../../logger");
const decorator_1 = require("../../../util/cache/package/decorator");
const clone_1 = require("../../../util/clone");
const datasource_1 = require("../datasource");
class JenkinsPluginsDatasource extends datasource_1.Datasource {
    constructor() {
        super(JenkinsPluginsDatasource.id);
        this.defaultRegistryUrls = ['https://updates.jenkins.io'];
        this.registryStrategy = 'hunt';
    }
    async getReleases({ packageName, }) {
        const plugins = await this.getJenkinsPluginInfo();
        const plugin = plugins[packageName];
        if (!plugin) {
            return null;
        }
        const result = (0, clone_1.clone)(plugin);
        const versions = await this.getJenkinsPluginVersions();
        const releases = versions[packageName];
        result.releases = releases ? (0, clone_1.clone)(releases) : [];
        return result;
    }
    async getJenkinsPluginInfo() {
        const { plugins } = await this.getJenkinsUpdateCenterResponse(JenkinsPluginsDatasource.packageInfoUrl);
        const info = {};
        for (const name of Object.keys(plugins ?? [])) {
            info[name] = {
                releases: [],
                sourceUrl: plugins[name]?.scm,
            };
        }
        return info;
    }
    async getJenkinsPluginVersions() {
        const { plugins } = await this.getJenkinsUpdateCenterResponse(JenkinsPluginsDatasource.packageVersionsUrl);
        const versions = {};
        for (const name of Object.keys(plugins ?? [])) {
            versions[name] = Object.keys(plugins[name]).map((version) => ({
                version,
                downloadUrl: plugins[name][version]?.url,
                releaseTimestamp: plugins[name][version]?.buildDate
                    ? new Date(`${plugins[name][version].buildDate} UTC`)
                    : null,
            }));
        }
        return versions;
    }
    async getJenkinsUpdateCenterResponse(url) {
        let response;
        try {
            logger_1.logger.debug(`jenkins-plugins: Fetching Jenkins plugins from ${url}`);
            const startTime = Date.now();
            response = (await this.http.getJson(url)).body;
            const durationMs = Math.round(Date.now() - startTime);
            logger_1.logger.debug({ durationMs }, `jenkins-plugins: Fetched Jenkins plugins from ${url}`);
        }
        catch (err) /* istanbul ignore next */ {
            this.handleGenericErrors(err);
        }
        return response;
    }
}
JenkinsPluginsDatasource.id = 'jenkins-plugins';
JenkinsPluginsDatasource.packageInfoUrl = 'https://updates.jenkins.io/current/update-center.actual.json';
JenkinsPluginsDatasource.packageVersionsUrl = 'https://updates.jenkins.io/current/plugin-versions.json';
tslib_1.__decorate([
    (0, decorator_1.cache)({
        namespace: JenkinsPluginsDatasource.id,
        key: 'info',
        ttlMinutes: 1440,
    })
], JenkinsPluginsDatasource.prototype, "getJenkinsPluginInfo", null);
tslib_1.__decorate([
    (0, decorator_1.cache)({ namespace: JenkinsPluginsDatasource.id, key: 'versions' })
], JenkinsPluginsDatasource.prototype, "getJenkinsPluginVersions", null);
exports.JenkinsPluginsDatasource = JenkinsPluginsDatasource;
//# sourceMappingURL=index.js.map