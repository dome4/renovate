"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerraformProviderDatasource = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const p_map_1 = tslib_1.__importDefault(require("p-map"));
const logger_1 = require("../../../logger");
const external_host_error_1 = require("../../../types/errors/external-host-error");
const decorator_1 = require("../../../util/cache/package/decorator");
const regex_1 = require("../../../util/regex");
const hashicorpVersioning = tslib_1.__importStar(require("../../versioning/hashicorp"));
const base_1 = require("../terraform-module/base");
class TerraformProviderDatasource extends base_1.TerraformDatasource {
    constructor() {
        super(TerraformProviderDatasource.id);
        this.defaultRegistryUrls = TerraformProviderDatasource.defaultRegistryUrls;
        this.defaultVersioning = hashicorpVersioning.id;
        this.registryStrategy = 'hunt';
    }
    async getReleases({ packageName, registryUrl, }) {
        // istanbul ignore if
        if (!registryUrl) {
            return null;
        }
        logger_1.logger.debug({ packageName }, 'terraform-provider.getDependencies()');
        if (registryUrl === this.defaultRegistryUrls[1]) {
            return await this.queryReleaseBackend(packageName, registryUrl);
        }
        const repository = TerraformProviderDatasource.getRepository({
            packageName,
        });
        const serviceDiscovery = await this.getTerraformServiceDiscoveryResult(registryUrl);
        if (registryUrl === this.defaultRegistryUrls[0]) {
            return await this.queryRegistryExtendedApi(serviceDiscovery, registryUrl, repository);
        }
        return await this.queryRegistryVersions(serviceDiscovery, registryUrl, repository);
    }
    static getRepository({ packageName }) {
        return packageName.includes('/') ? packageName : `hashicorp/${packageName}`;
    }
    /**
     * this uses the api that terraform registry has in addition to the base api
     * this endpoint provides more information, such as release date
     * this api is undocumented.
     */
    async queryRegistryExtendedApi(serviceDiscovery, registryUrl, repository) {
        const backendURL = `${registryUrl}${serviceDiscovery['providers.v1']}${repository}`;
        const res = (await this.http.getJson(backendURL)).body;
        const dep = {
            releases: res.versions.map((version) => ({
                version,
            })),
        };
        if (res.source) {
            dep.sourceUrl = res.source;
        }
        // set published date for latest release
        const latestVersion = dep.releases.find((release) => res.version === release.version);
        // istanbul ignore else
        if (latestVersion) {
            latestVersion.releaseTimestamp = res.published_at;
        }
        dep.homepage = `${registryUrl}/providers/${repository}`;
        return dep;
    }
    /**
     * this version uses the Provider Registry Protocol that all registries are required to implement
     * https://www.terraform.io/internals/provider-registry-protocol
     */
    async queryRegistryVersions(serviceDiscovery, registryUrl, repository) {
        const backendURL = `${registryUrl}${serviceDiscovery['providers.v1']}${repository}/versions`;
        const res = (await this.http.getJson(backendURL))
            .body;
        const dep = {
            releases: res.versions.map(({ version }) => ({
                version,
            })),
        };
        return dep;
    }
    // TODO: add long term cache (#9590)
    async queryReleaseBackend(packageName, registryURL) {
        const backendLookUpName = `terraform-provider-${packageName}`;
        const backendURL = registryURL + `/index.json`;
        const res = (await this.http.getJson(backendURL)).body;
        if (!res[backendLookUpName]) {
            return null;
        }
        const dep = {
            releases: Object.keys(res[backendLookUpName].versions).map((version) => ({
                version,
            })),
            sourceUrl: `https://github.com/terraform-providers/${backendLookUpName}`,
        };
        return dep;
    }
    async getBuilds(registryURL, repository, version) {
        if (registryURL === TerraformProviderDatasource.defaultRegistryUrls[1]) {
            // check if registryURL === secondary backend
            const repositoryRegexResult = TerraformProviderDatasource.repositoryRegex.exec(repository)?.groups;
            if (!repositoryRegexResult) {
                // non hashicorp builds are not supported with releases.hashicorp.com
                return null;
            }
            const packageName = repositoryRegexResult.packageName;
            const backendLookUpName = `terraform-provider-${packageName}`;
            let versionReleaseBackend;
            try {
                versionReleaseBackend = await this.getReleaseBackendIndex(backendLookUpName, version);
            }
            catch (err) {
                /* istanbul ignore next */
                if (err instanceof external_host_error_1.ExternalHostError) {
                    throw err;
                }
                logger_1.logger.debug({ err, backendLookUpName, version }, `Failed to retrieve builds for ${backendLookUpName} ${version}`);
                return null;
            }
            return versionReleaseBackend.builds;
        }
        // check public or private Terraform registry
        const serviceDiscovery = await this.getTerraformServiceDiscoveryResult(registryURL);
        if (!serviceDiscovery) {
            logger_1.logger.trace(`Failed to retrieve service discovery from ${registryURL}`);
            return null;
        }
        const backendURL = `${registryURL}${serviceDiscovery['providers.v1']}${repository}`;
        const versionsResponse = (await this.http.getJson(`${backendURL}/versions`)).body;
        if (!versionsResponse.versions) {
            logger_1.logger.trace(`Failed to retrieve version list for ${backendURL}`);
            return null;
        }
        const builds = versionsResponse.versions.find((value) => value.version === version);
        if (!builds) {
            logger_1.logger.trace(`No builds found for ${repository}:${version} on ${registryURL}`);
            return null;
        }
        const result = await (0, p_map_1.default)(builds.platforms, async (platform) => {
            const buildURL = `${backendURL}/${version}/download/${platform.os}/${platform.arch}`;
            try {
                const res = (await this.http.getJson(buildURL)).body;
                const newBuild = {
                    name: repository,
                    url: res.download_url,
                    version,
                    ...res,
                };
                return newBuild;
            }
            catch (err) {
                /* istanbul ignore next */
                if (err instanceof external_host_error_1.ExternalHostError) {
                    throw err;
                }
                logger_1.logger.debug({ err, url: buildURL }, 'Failed to retrieve build');
                return null;
            }
        }, { concurrency: 4 });
        const filteredResult = result.filter(is_1.default.truthy);
        return filteredResult.length === result.length ? filteredResult : null;
    }
    async getReleaseBackendIndex(backendLookUpName, version) {
        return (await this.http.getJson(`${TerraformProviderDatasource.defaultRegistryUrls[1]}/${backendLookUpName}/${version}/index.json`)).body;
    }
}
TerraformProviderDatasource.id = 'terraform-provider';
TerraformProviderDatasource.defaultRegistryUrls = [
    'https://registry.terraform.io',
    'https://releases.hashicorp.com',
];
TerraformProviderDatasource.repositoryRegex = (0, regex_1.regEx)(/^hashicorp\/(?<packageName>\S+)$/);
tslib_1.__decorate([
    (0, decorator_1.cache)({
        namespace: `datasource-${TerraformProviderDatasource.id}`,
        key: (getReleasesConfig) => `${getReleasesConfig.registryUrl}/${TerraformProviderDatasource.getRepository(getReleasesConfig)}`,
    })
], TerraformProviderDatasource.prototype, "getReleases", null);
tslib_1.__decorate([
    (0, decorator_1.cache)({
        namespace: `datasource-${TerraformProviderDatasource.id}-builds`,
        key: (registryURL, repository, version) => `${registryURL}/${repository}/${version}`,
    })
], TerraformProviderDatasource.prototype, "getBuilds", null);
tslib_1.__decorate([
    (0, decorator_1.cache)({
        namespace: `datasource-${TerraformProviderDatasource.id}-releaseBackendIndex`,
        key: (backendLookUpName, version) => `${backendLookUpName}/${version}`,
    })
], TerraformProviderDatasource.prototype, "getReleaseBackendIndex", null);
exports.TerraformProviderDatasource = TerraformProviderDatasource;
//# sourceMappingURL=index.js.map