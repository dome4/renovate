"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackagistDatasource = void 0;
const tslib_1 = require("tslib");
const url_1 = tslib_1.__importDefault(require("url"));
const p_all_1 = tslib_1.__importDefault(require("p-all"));
const logger_1 = require("../../../logger");
const external_host_error_1 = require("../../../types/errors/external-host-error");
const packageCache = tslib_1.__importStar(require("../../../util/cache/package"));
const decorator_1 = require("../../../util/cache/package/decorator");
const hostRules = tslib_1.__importStar(require("../../../util/host-rules"));
const regex_1 = require("../../../util/regex");
const url_2 = require("../../../util/url");
const composerVersioning = tslib_1.__importStar(require("../../versioning/composer"));
const datasource_1 = require("../datasource");
class PackagistDatasource extends datasource_1.Datasource {
    constructor() {
        super(PackagistDatasource.id);
        this.defaultRegistryUrls = ['https://packagist.org'];
        this.defaultVersioning = composerVersioning.id;
        this.registryStrategy = 'hunt';
    }
    getReleases({ packageName, registryUrl, }) {
        logger_1.logger.trace(`getReleases(${packageName})`);
        // istanbul ignore if
        if (!registryUrl) {
            return Promise.resolve(null);
        }
        return this.packageLookup(registryUrl, packageName);
    }
    // We calculate auth at this datasource layer so that we can know whether it's safe to cache or not
    static getHostOpts(url) {
        let opts = {};
        const { username, password } = hostRules.find({
            hostType: PackagistDatasource.id,
            url,
        });
        if (username && password) {
            opts = { ...opts, username, password };
        }
        return opts;
    }
    async getRegistryMeta(regUrl) {
        const url = url_1.default.resolve((0, url_2.ensureTrailingSlash)(regUrl), 'packages.json');
        const opts = PackagistDatasource.getHostOpts(url);
        const res = (await this.http.getJson(url, opts)).body;
        const meta = {
            providerPackages: {},
            packages: res.packages,
        };
        if (res.includes) {
            meta.includesFiles = [];
            for (const [name, val] of Object.entries(res.includes)) {
                const file = {
                    key: name.replace(val.sha256, '%hash%'),
                    sha256: val.sha256,
                };
                meta.includesFiles.push(file);
            }
        }
        if (res['providers-url']) {
            meta.providersUrl = res['providers-url'];
        }
        if (res['providers-lazy-url']) {
            meta.providersLazyUrl = res['providers-lazy-url'];
        }
        if (res['provider-includes']) {
            meta.files = [];
            for (const [key, val] of Object.entries(res['provider-includes'])) {
                const file = {
                    key,
                    sha256: val.sha256,
                };
                meta.files.push(file);
            }
        }
        if (res.providers) {
            for (const [key, val] of Object.entries(res.providers)) {
                meta.providerPackages[key] = val.sha256;
            }
        }
        return meta;
    }
    static isPrivatePackage(regUrl) {
        const opts = PackagistDatasource.getHostOpts(regUrl);
        return !!opts.password || !!opts.headers?.authorization;
    }
    static getPackagistFileUrl(regUrl, regFile) {
        const { key, sha256 } = regFile;
        const fileName = key.replace('%hash%', sha256);
        const url = `${regUrl}/${fileName}`;
        return url;
    }
    async getPackagistFile(regUrl, regFile) {
        const url = PackagistDatasource.getPackagistFileUrl(regUrl, regFile);
        const opts = PackagistDatasource.getHostOpts(regUrl);
        const { body: packagistFile } = await this.http.getJson(url, opts);
        return packagistFile;
    }
    static extractDepReleases(versions) {
        const dep = { releases: [] };
        // istanbul ignore if
        if (!versions) {
            return dep;
        }
        dep.releases = Object.keys(versions).map((version) => {
            // TODO: fix function parameter type: `versions`
            const release = versions[version];
            const parsedVersion = release.version ?? version;
            dep.homepage = release.homepage || dep.homepage;
            if (release.source?.url) {
                dep.sourceUrl = release.source.url;
            }
            return {
                version: parsedVersion.replace((0, regex_1.regEx)(/^v/), ''),
                gitRef: parsedVersion,
                releaseTimestamp: release.time,
            };
        });
        return dep;
    }
    async getAllPackages(regUrl) {
        const registryMeta = await this.getRegistryMeta(regUrl);
        // istanbul ignore if: needs test
        if (!registryMeta) {
            return null;
        }
        const { packages, providersUrl, providersLazyUrl, files, includesFiles, providerPackages, } = registryMeta;
        if (files) {
            const queue = files.map((file) => () => this.getPackagistFile(regUrl, file));
            const resolvedFiles = await (0, p_all_1.default)(queue, { concurrency: 5 });
            for (const res of resolvedFiles) {
                for (const [name, val] of Object.entries(res.providers)) {
                    providerPackages[name] = val.sha256;
                }
            }
        }
        const includesPackages = {};
        if (includesFiles) {
            for (const file of includesFiles) {
                const res = await this.getPackagistFile(regUrl, file);
                if (res.packages) {
                    for (const [key, val] of Object.entries(res.packages)) {
                        const dep = PackagistDatasource.extractDepReleases(val);
                        includesPackages[key] = dep;
                    }
                }
            }
        }
        const allPackages = {
            packages,
            providersUrl,
            providersLazyUrl,
            providerPackages,
            includesPackages,
        };
        return allPackages;
    }
    async packagistOrgLookup(name) {
        const cacheNamespace = 'datasource-packagist-org';
        const cachedResult = await packageCache.get(cacheNamespace, name);
        // istanbul ignore if
        if (cachedResult) {
            return cachedResult;
        }
        let dep = null;
        const regUrl = 'https://packagist.org';
        const pkgUrl = [
            (0, url_2.joinUrlParts)(regUrl, `/p2/${name}.json`),
            (0, url_2.joinUrlParts)(regUrl, `/p2/${name}~dev.json`),
        ];
        // TODO: fix types (#9610)
        let res = (await this.http.getJson(pkgUrl[0])).body.packages[name];
        res = [
            ...res,
            ...(await this.http.getJson(pkgUrl[1])).body.packages[name],
        ];
        if (res) {
            dep = PackagistDatasource.extractDepReleases(res);
            logger_1.logger.trace({ dep }, 'dep');
        }
        const cacheMinutes = 10;
        await packageCache.set(cacheNamespace, name, dep, cacheMinutes);
        return dep;
    }
    async packageLookup(regUrl, name) {
        try {
            if (regUrl === 'https://packagist.org') {
                const packagistResult = await this.packagistOrgLookup(name);
                return packagistResult;
            }
            const allPackages = await this.getAllPackages(regUrl);
            // istanbul ignore if: needs test
            if (!allPackages) {
                return null;
            }
            const { packages, providersUrl, providersLazyUrl, providerPackages, includesPackages, } = allPackages;
            if (packages?.[name]) {
                const dep = PackagistDatasource.extractDepReleases(packages[name]);
                return dep;
            }
            if (includesPackages?.[name]) {
                return includesPackages[name];
            }
            let pkgUrl;
            if (name in providerPackages) {
                pkgUrl = url_1.default.resolve(regUrl, 
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                providersUrl
                    .replace('%package%', name)
                    .replace('%hash%', providerPackages[name]));
            }
            else if (providersLazyUrl) {
                pkgUrl = url_1.default.resolve(regUrl, providersLazyUrl.replace('%package%', name));
            }
            else {
                return null;
            }
            const opts = PackagistDatasource.getHostOpts(regUrl);
            // TODO: fix types (#9610)
            const versions = (await this.http.getJson(pkgUrl, opts)).body
                .packages[name];
            const dep = PackagistDatasource.extractDepReleases(versions);
            logger_1.logger.trace({ dep }, 'dep');
            return dep;
        }
        catch (err) /* istanbul ignore next */ {
            if (err.host === 'packagist.org') {
                if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
                    throw new external_host_error_1.ExternalHostError(err);
                }
                if (err.statusCode && err.statusCode >= 500 && err.statusCode < 600) {
                    throw new external_host_error_1.ExternalHostError(err);
                }
            }
            throw err;
        }
    }
}
PackagistDatasource.id = 'packagist';
tslib_1.__decorate([
    (0, decorator_1.cache)({
        namespace: `datasource-${PackagistDatasource.id}-public-files`,
        key: (regUrl, regFile) => PackagistDatasource.getPackagistFileUrl(regUrl, regFile),
        cacheable: (regUrl) => !PackagistDatasource.isPrivatePackage(regUrl),
        ttlMinutes: 1440,
    })
], PackagistDatasource.prototype, "getPackagistFile", null);
tslib_1.__decorate([
    (0, decorator_1.cache)({
        namespace: `datasource-${PackagistDatasource.id}`,
        key: (regUrl) => regUrl,
    })
], PackagistDatasource.prototype, "getAllPackages", null);
exports.PackagistDatasource = PackagistDatasource;
//# sourceMappingURL=index.js.map