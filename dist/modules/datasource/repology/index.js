"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepologyDatasource = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const error_messages_1 = require("../../../constants/error-messages");
const logger_1 = require("../../../logger");
const external_host_error_1 = require("../../../types/errors/external-host-error");
const decorator_1 = require("../../../util/cache/package/decorator");
const url_1 = require("../../../util/url");
const datasource_1 = require("../datasource");
const packageTypes = ['binname', 'srcname'];
function findPackageInResponse(response, repoName, pkgName, types) {
    const repoPackages = response.filter((pkg) => pkg.repo === repoName);
    if (repoPackages.length === 0) {
        // no packages associated with repoName
        return null;
    }
    if (repoPackages.length === 1) {
        // repo contains exactly one package, so we can return them safely
        return repoPackages;
    }
    // In some cases Repology bundles multiple packages into a single project, which might result in ambiguous results.
    // We need to do additional filtering by matching allowed package types passed as params with package description.
    // Remaining packages are the one we are looking for
    const packagesWithType = repoPackages.filter((pkg) => {
        for (const pkgType of types) {
            if (pkg[pkgType] && pkg[pkgType] === pkgName) {
                return true;
            }
        }
        return false;
    });
    return packagesWithType.length > 0 ? packagesWithType : null;
}
class RepologyDatasource extends datasource_1.Datasource {
    constructor() {
        super(RepologyDatasource.id);
        this.defaultRegistryUrls = ['https://repology.org/'];
        this.registryStrategy = 'hunt';
    }
    async queryPackages(url) {
        try {
            const res = await this.http.getJson(url);
            return res.body;
        }
        catch (err) {
            if (err.statusCode === 404) {
                // Return an array here because the api does not return proper http codes
                // and instead of an 404 error an empty array with code 200 is returned
                // When querying the resolver 404 is thrown if package could not be resolved
                // and 403 if the repo is not supported
                // 403 is handled later because in this case we are trying the API
                return [];
            }
            throw err;
        }
    }
    async queryPackagesViaResolver(registryUrl, repoName, packageName, packageType) {
        const query = (0, url_1.getQueryString)({
            repo: repoName,
            name_type: packageType,
            target_page: 'api_v1_project',
            noautoresolve: 'on',
            name: packageName,
        });
        // Retrieve list of packages by looking up Repology project
        const packages = await this.queryPackages((0, url_1.joinUrlParts)(registryUrl, `tools/project-by?${query}`));
        return packages;
    }
    async queryPackagesViaAPI(registryUrl, packageName) {
        // Directly query the package via the API. This will only work if `packageName` has the
        // same name as the repology project
        const packages = await this.queryPackages((0, url_1.joinUrlParts)(registryUrl, `api/v1/project`, packageName));
        return packages;
    }
    async queryPackage(registryUrl, repoName, pkgName) {
        let response;
        // Try getting the packages from tools/project-by first for type binname and
        // afterwards for srcname. This needs to be done first, because some packages
        // resolve to repology projects which have a different name than the package
        // e.g. `pulseaudio-utils` resolves to project `pulseaudio`, BUT there is also
        // a project called `pulseaudio-utils` but it does not contain the package we
        // are looking for.
        try {
            for (const pkgType of packageTypes) {
                response = await this.queryPackagesViaResolver(registryUrl, repoName, pkgName, pkgType);
                if (response) {
                    const pkg = findPackageInResponse(response, repoName, pkgName, [
                        pkgType,
                    ]);
                    if (is_1.default.nonEmptyArray(pkg)) {
                        // exit immediately if package found
                        return pkg;
                    }
                }
            }
        }
        catch (err) {
            if (err.statusCode === 403) {
                logger_1.logger.debug({ repoName, pkgName }, 'Repology does not support tools/project-by lookups for repository. Will try direct API access now');
                // If the repository is not supported in tools/project-by we try directly accessing the
                // API. This will support all repositories but requires that the project name is equal to the
                // package name. This won't be always the case but for a good portion we might be able to resolve
                // the package this way.
                response = await this.queryPackagesViaAPI(registryUrl, pkgName);
                const pkg = findPackageInResponse(response, repoName, pkgName, packageTypes);
                if (is_1.default.nonEmptyArray(pkg)) {
                    // exit immediately if package found
                    return pkg;
                }
            }
            else if (err.statusCode === 300) {
                logger_1.logger.warn({ repoName, pkgName }, 'Ambiguous redirection from package name to project name in Repology. Skipping this package');
                return undefined;
            }
            throw err;
        }
        logger_1.logger.debug({ repoName, pkgName }, 'Repository or package not found on Repology');
        return undefined;
    }
    async getReleases({ packageName, registryUrl, }) {
        // istanbul ignore if
        if (!registryUrl) {
            return null;
        }
        // Ensure lookup name contains both repository and package
        const [repoName, pkgName] = packageName.split('/', 2);
        if (!repoName || !pkgName) {
            throw new external_host_error_1.ExternalHostError(new Error('Repology lookup name must contain repository and package separated by slash (<repo>/<pkg>)'));
        }
        logger_1.logger.trace(`repology.getReleases(${repoName}, ${pkgName})`);
        try {
            // Attempt to retrieve (cached) package information from Repology
            const pkg = await this.queryPackage(registryUrl, repoName, pkgName);
            if (!pkg) {
                return null;
            }
            // Always prefer origversion if available, otherwise default to version
            // This is required as source packages usually have no origversion
            const releases = pkg.map((item) => ({
                version: item.origversion ?? item.version,
            }));
            return { releases };
        }
        catch (err) {
            if (err.message === error_messages_1.HOST_DISABLED) {
                // istanbul ignore next
                logger_1.logger.trace({ packageName, err }, 'Host disabled');
            }
            else {
                logger_1.logger.warn({ packageName, err }, 'Repology lookup failed with unexpected error');
            }
            throw new external_host_error_1.ExternalHostError(err);
        }
    }
}
RepologyDatasource.id = 'repology';
tslib_1.__decorate([
    (0, decorator_1.cache)({
        ttlMinutes: 60,
        namespace: `datasource-${RepologyDatasource.id}-list`,
        key: (registryUrl, repoName, pkgName) => (0, url_1.joinUrlParts)(registryUrl, repoName, pkgName),
    })
], RepologyDatasource.prototype, "queryPackage", null);
exports.RepologyDatasource = RepologyDatasource;
//# sourceMappingURL=index.js.map