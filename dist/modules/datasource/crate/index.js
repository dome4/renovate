"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrateDatasource = void 0;
const tslib_1 = require("tslib");
const hasha_1 = tslib_1.__importDefault(require("hasha"));
const simple_git_1 = tslib_1.__importDefault(require("simple-git"));
const upath_1 = tslib_1.__importDefault(require("upath"));
const global_1 = require("../../../config/global");
const logger_1 = require("../../../logger");
const memCache = tslib_1.__importStar(require("../../../util/cache/memory"));
const decorator_1 = require("../../../util/cache/package/decorator");
const fs_1 = require("../../../util/fs");
const config_1 = require("../../../util/git/config");
const regex_1 = require("../../../util/regex");
const url_1 = require("../../../util/url");
const cargoVersioning = tslib_1.__importStar(require("../../versioning/cargo"));
const datasource_1 = require("../datasource");
const types_1 = require("./types");
class CrateDatasource extends datasource_1.Datasource {
    constructor() {
        super(CrateDatasource.id);
        this.defaultRegistryUrls = ['https://crates.io'];
        this.defaultVersioning = cargoVersioning.id;
    }
    async getReleases({ packageName, registryUrl, }) {
        // istanbul ignore if
        if (!registryUrl) {
            logger_1.logger.warn('crate datasource: No registryUrl specified, cannot perform getReleases');
            return null;
        }
        const registryInfo = await CrateDatasource.fetchRegistryInfo({
            packageName,
            registryUrl,
        });
        if (!registryInfo) {
            logger_1.logger.debug({ registryUrl }, 'Could not fetch registry info');
            return null;
        }
        const dependencyUrl = CrateDatasource.getDependencyUrl(registryInfo, packageName);
        const payload = await this.fetchCrateRecordsPayload(registryInfo, packageName);
        const lines = payload
            .split(regex_1.newlineRegex) // break into lines
            .map((line) => line.trim()) // remove whitespace
            .filter((line) => line.length !== 0) // remove empty lines
            .map((line) => JSON.parse(line)); // parse
        const metadata = await this.getCrateMetadata(registryInfo, packageName);
        const result = {
            dependencyUrl,
            releases: [],
        };
        if (metadata?.homepage) {
            result.homepage = metadata.homepage;
        }
        if (metadata?.repository) {
            result.sourceUrl = metadata.repository;
        }
        result.releases = lines
            .map((version) => {
            const release = {
                version: version.vers,
            };
            if (version.yanked) {
                release.isDeprecated = true;
            }
            return release;
        })
            .filter((release) => release.version);
        if (!result.releases.length) {
            return null;
        }
        return result;
    }
    async getCrateMetadata(info, packageName) {
        if (info.flavor !== types_1.RegistryFlavor.CratesIo) {
            return null;
        }
        // The `?include=` suffix is required to avoid unnecessary database queries
        // on the crates.io server. This lets us work around the regular request
        // throttling of one request per second.
        const crateUrl = `${CrateDatasource.CRATES_IO_API_BASE_URL}crates/${packageName}?include=`;
        logger_1.logger.debug({ crateUrl, packageName, registryUrl: info.rawUrl }, 'downloading crate metadata');
        try {
            const response = await this.http.getJson(crateUrl);
            return response.body.crate;
        }
        catch (err) {
            logger_1.logger.warn({ err, packageName, registryUrl: info.rawUrl }, 'failed to download crate metadata');
        }
        return null;
    }
    async fetchCrateRecordsPayload(info, packageName) {
        if (info.clonePath) {
            const path = upath_1.default.join(info.clonePath, ...CrateDatasource.getIndexSuffix(packageName));
            return (0, fs_1.readFile)(path, 'utf8');
        }
        if (info.flavor === types_1.RegistryFlavor.CratesIo) {
            const crateUrl = CrateDatasource.CRATES_IO_BASE_URL +
                CrateDatasource.getIndexSuffix(packageName).join('/');
            try {
                return (await this.http.get(crateUrl)).body;
            }
            catch (err) {
                this.handleGenericErrors(err);
            }
        }
        throw new Error(`unsupported crate registry flavor: ${info.flavor}`);
    }
    /**
     * Computes the dependency URL for a crate, given
     * registry information
     */
    static getDependencyUrl(info, packageName) {
        switch (info.flavor) {
            case types_1.RegistryFlavor.CratesIo:
                return `https://crates.io/crates/${packageName}`;
            case types_1.RegistryFlavor.Cloudsmith: {
                // input: https://dl.cloudsmith.io/basic/$org/$repo/cargo/index.git
                const tokens = info.url.pathname.split('/');
                const org = tokens[2];
                const repo = tokens[3];
                return `https://cloudsmith.io/~${org}/repos/${repo}/packages/detail/cargo/${packageName}`;
            }
            default:
                return `${info.rawUrl}/${packageName}`;
        }
    }
    /**
     * Given a Git URL, computes a semi-human-readable name for a folder in which to
     * clone the repository.
     */
    static cacheDirFromUrl(url) {
        const proto = url.protocol.replace((0, regex_1.regEx)(/:$/), '');
        const host = url.hostname;
        const hash = (0, hasha_1.default)(url.pathname, {
            algorithm: 'sha256',
        }).substr(0, 7);
        return `crate-registry-${proto}-${host}-${hash}`;
    }
    /**
     * Fetches information about a registry, by url.
     * If no url is given, assumes crates.io.
     * If an url is given, assumes it's a valid Git repository
     * url and clones it to cache.
     */
    static async fetchRegistryInfo({ packageName, registryUrl, }) {
        // istanbul ignore if
        if (!registryUrl) {
            return null;
        }
        const url = (0, url_1.parseUrl)(registryUrl);
        if (!url) {
            logger_1.logger.debug({ registryUrl }, 'could not parse registry URL');
            return null;
        }
        let flavor;
        if (url.hostname === 'crates.io') {
            flavor = types_1.RegistryFlavor.CratesIo;
        }
        else if (url.hostname === 'dl.cloudsmith.io') {
            flavor = types_1.RegistryFlavor.Cloudsmith;
        }
        else {
            flavor = types_1.RegistryFlavor.Other;
        }
        const registry = {
            flavor,
            rawUrl: registryUrl,
            url,
        };
        if (flavor !== types_1.RegistryFlavor.CratesIo) {
            if (!global_1.GlobalConfig.get('allowCustomCrateRegistries')) {
                logger_1.logger.warn('crate datasource: allowCustomCrateRegistries=true is required for registries other than crates.io, bailing out');
                return null;
            }
            const cacheKey = `crate-datasource/registry-clone-path/${registryUrl}`;
            const cacheKeyForError = `crate-datasource/registry-clone-path/${registryUrl}/error`;
            // We need to ensure we don't run `git clone` in parallel. Therefore we store
            // a promise of the running operation in the mem cache, which in the end resolves
            // to the file path of the cloned repository.
            const clonePathPromise = memCache.get(cacheKey);
            let clonePath;
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            if (clonePathPromise) {
                clonePath = await clonePathPromise;
            }
            else {
                clonePath = upath_1.default.join((0, fs_1.privateCacheDir)(), CrateDatasource.cacheDirFromUrl(url));
                logger_1.logger.info({ clonePath, registryUrl }, `Cloning private cargo registry`);
                const git = (0, simple_git_1.default)({ ...(0, config_1.simpleGitConfig)(), maxConcurrentProcesses: 1 });
                const clonePromise = git.clone(registryUrl, clonePath, {
                    '--depth': 1,
                });
                memCache.set(cacheKey, clonePromise.then(() => clonePath).catch(() => null));
                try {
                    await clonePromise;
                }
                catch (err) {
                    logger_1.logger.warn({ err, packageName, registryUrl }, 'failed cloning git registry');
                    memCache.set(cacheKeyForError, err);
                    return null;
                }
            }
            if (!clonePath) {
                const err = memCache.get(cacheKeyForError);
                logger_1.logger.warn({ err, packageName, registryUrl }, 'Previous git clone failed, bailing out.');
                return null;
            }
            registry.clonePath = clonePath;
        }
        return registry;
    }
    static areReleasesCacheable(registryUrl) {
        // We only cache public releases, we don't want to cache private
        // cloned data between runs.
        return registryUrl === 'https://crates.io';
    }
    static getIndexSuffix(packageName) {
        const len = packageName.length;
        if (len === 1) {
            return ['1', packageName];
        }
        if (len === 2) {
            return ['2', packageName];
        }
        if (len === 3) {
            return ['3', packageName[0], packageName];
        }
        return [packageName.slice(0, 2), packageName.slice(2, 4), packageName];
    }
}
CrateDatasource.id = 'crate';
CrateDatasource.CRATES_IO_BASE_URL = 'https://raw.githubusercontent.com/rust-lang/crates.io-index/master/';
CrateDatasource.CRATES_IO_API_BASE_URL = 'https://crates.io/api/v1/';
tslib_1.__decorate([
    (0, decorator_1.cache)({
        namespace: `datasource-${CrateDatasource.id}`,
        key: ({ registryUrl, packageName }) => `${registryUrl}/${packageName}`,
        cacheable: ({ registryUrl }) => CrateDatasource.areReleasesCacheable(registryUrl),
    })
], CrateDatasource.prototype, "getReleases", null);
tslib_1.__decorate([
    (0, decorator_1.cache)({
        namespace: `datasource-${CrateDatasource.id}-metadata`,
        key: (info, packageName) => `${info.rawUrl}/${packageName}`,
        cacheable: (info) => CrateDatasource.areReleasesCacheable(info.rawUrl),
        ttlMinutes: 24 * 60, // 24 hours
    })
], CrateDatasource.prototype, "getCrateMetadata", null);
exports.CrateDatasource = CrateDatasource;
//# sourceMappingURL=index.js.map