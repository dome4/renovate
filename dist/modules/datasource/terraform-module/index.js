"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerraformModuleDatasource = void 0;
const tslib_1 = require("tslib");
const logger_1 = require("../../../logger");
const decorator_1 = require("../../../util/cache/package/decorator");
const regex_1 = require("../../../util/regex");
const hashicorpVersioning = tslib_1.__importStar(require("../../versioning/hashicorp"));
const base_1 = require("./base");
class TerraformModuleDatasource extends base_1.TerraformDatasource {
    constructor() {
        super(TerraformModuleDatasource.id);
        this.defaultRegistryUrls = ['https://registry.terraform.io'];
        this.defaultVersioning = hashicorpVersioning.id;
    }
    /**
     * This function will fetch a package from the specified Terraform registry and return all semver versions.
     *  - `sourceUrl` is supported of "source" field is set
     *  - `homepage` is set to the Terraform registry's page if it's on the official main registry
     */
    async getReleases({ packageName, registryUrl, }) {
        // istanbul ignore if
        if (!registryUrl) {
            return null;
        }
        const { registry: registryUrlNormalized, repository } = TerraformModuleDatasource.getRegistryRepository(packageName, registryUrl);
        logger_1.logger.trace({ registryUrlNormalized, terraformRepository: repository }, 'terraform-module.getReleases()');
        const serviceDiscovery = await this.getTerraformServiceDiscoveryResult(registryUrlNormalized);
        if (registryUrlNormalized === this.defaultRegistryUrls[0]) {
            return await this.queryRegistryExtendedApi(serviceDiscovery, registryUrlNormalized, repository);
        }
        return await this.queryRegistryVersions(serviceDiscovery, registryUrlNormalized, repository);
    }
    /**
     * this uses the api that terraform registry has in addition to the base api
     * this endpoint provides more information, such as release date
     * https://www.terraform.io/registry/api-docs#latest-version-for-a-specific-module-provider
     */
    async queryRegistryExtendedApi(serviceDiscovery, registryUrl, repository) {
        let res;
        let pkgUrl;
        try {
            pkgUrl = `${registryUrl}${serviceDiscovery['modules.v1']}${repository}`;
            res = (await this.http.getJson(pkgUrl)).body;
            const returnedName = res.namespace + '/' + res.name + '/' + res.provider;
            if (returnedName !== repository) {
                logger_1.logger.warn({ pkgUrl }, 'Terraform registry result mismatch');
                return null;
            }
        }
        catch (err) {
            this.handleGenericErrors(err);
        }
        // Simplify response before caching and returning
        const dep = {
            releases: res.versions.map((version) => ({
                version,
            })),
        };
        if (res.source) {
            dep.sourceUrl = res.source;
        }
        dep.homepage = `${registryUrl}/modules/${repository}`;
        // set published date for latest release
        const latestVersion = dep.releases.find((release) => res.version === release.version);
        if (latestVersion) {
            latestVersion.releaseTimestamp = res.published_at;
        }
        return dep;
    }
    /**
     * this version uses the Module Registry Protocol that all registries are required to implement
     * https://www.terraform.io/internals/module-registry-protocol
     */
    async queryRegistryVersions(serviceDiscovery, registryUrl, repository) {
        let res;
        let pkgUrl;
        try {
            pkgUrl = `${registryUrl}${serviceDiscovery['modules.v1']}${repository}/versions`;
            res = (await this.http.getJson(pkgUrl)).body;
            if (res.modules.length < 1) {
                logger_1.logger.warn({ pkgUrl }, 'Terraform registry result mismatch');
                return null;
            }
        }
        catch (err) {
            this.handleGenericErrors(err);
        }
        // Simplify response before caching and returning
        const dep = {
            releases: res.modules[0].versions.map(({ version }) => ({
                version,
            })),
        };
        return dep;
    }
    static getRegistryRepository(packageName, registryUrl = '') {
        let registry;
        const split = packageName.split('/');
        if (split.length > 3 && split[0].includes('.')) {
            [registry] = split;
            split.shift();
        }
        else {
            registry = registryUrl;
        }
        if (!(0, regex_1.regEx)(/^https?:\/\//).test(registry)) {
            registry = `https://${registry}`;
        }
        const repository = split.join('/');
        return {
            registry,
            repository,
        };
    }
    static getCacheKey({ packageName, registryUrl, }) {
        const { registry, repository } = TerraformModuleDatasource.getRegistryRepository(packageName, registryUrl);
        return `${registry}/${repository}`;
    }
}
TerraformModuleDatasource.id = 'terraform-module';
tslib_1.__decorate([
    (0, decorator_1.cache)({
        namespace: `datasource-${TerraformModuleDatasource.id}`,
        key: (getReleasesConfig) => TerraformModuleDatasource.getCacheKey(getReleasesConfig),
    })
], TerraformModuleDatasource.prototype, "getReleases", null);
exports.TerraformModuleDatasource = TerraformModuleDatasource;
//# sourceMappingURL=index.js.map