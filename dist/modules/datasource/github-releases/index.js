"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GithubReleasesDatasource = exports.cacheNamespace = void 0;
const tslib_1 = require("tslib");
const hasha_1 = tslib_1.__importDefault(require("hasha"));
const logger_1 = require("../../../logger");
const decorator_1 = require("../../../util/cache/package/decorator");
const github_1 = require("../../../util/http/github");
const regex_1 = require("../../../util/regex");
const datasource_1 = require("../datasource");
const cache_1 = require("./cache");
const common_1 = require("./common");
exports.cacheNamespace = 'datasource-github-releases';
function inferHashAlg(digest) {
    switch (digest.length) {
        case 64:
            return 'sha256';
        default:
        case 96:
            return 'sha512';
    }
}
class GithubReleasesDatasource extends datasource_1.Datasource {
    constructor(id = GithubReleasesDatasource.id) {
        super(id);
        this.defaultRegistryUrls = ['https://github.com'];
        this.http = new github_1.GithubHttp(id);
        this.releasesCache = new cache_1.CacheableGithubReleases(this.http);
    }
    async findDigestFile(release, digest) {
        const smallAssets = release.assets.filter((a) => a.size < 5 * 1024);
        for (const asset of smallAssets) {
            const res = await this.http.get(asset.browser_download_url);
            for (const line of res.body.split(regex_1.newlineRegex)) {
                const [lineDigest, lineFn] = line.split((0, regex_1.regEx)(/\s+/), 2);
                if (lineDigest === digest) {
                    return {
                        assetName: asset.name,
                        digestedFileName: lineFn,
                        currentVersion: release.tag_name,
                        currentDigest: lineDigest,
                    };
                }
            }
        }
        return null;
    }
    async downloadAndDigest(asset, algorithm) {
        const res = this.http.stream(asset.browser_download_url);
        const digest = await hasha_1.default.fromStream(res, { algorithm });
        return digest;
    }
    async findAssetWithDigest(release, digest) {
        const algorithm = inferHashAlg(digest);
        const assetsBySize = release.assets.sort((a, b) => {
            if (a.size < b.size) {
                return -1;
            }
            if (a.size > b.size) {
                return 1;
            }
            return 0;
        });
        for (const asset of assetsBySize) {
            const assetDigest = await this.downloadAndDigest(asset, algorithm);
            if (assetDigest === digest) {
                return {
                    assetName: asset.name,
                    currentVersion: release.tag_name,
                    currentDigest: assetDigest,
                };
            }
        }
        return null;
    }
    /** Identify the asset associated with a known digest. */
    async findDigestAsset(release, digest) {
        const digestFile = await this.findDigestFile(release, digest);
        if (digestFile) {
            return digestFile;
        }
        const asset = await this.findAssetWithDigest(release, digest);
        return asset;
    }
    /** Given a digest asset, find the equivalent digest in a different release. */
    async mapDigestAssetToRelease(digestAsset, release) {
        const current = digestAsset.currentVersion.replace((0, regex_1.regEx)(/^v/), '');
        const next = release.tag_name.replace((0, regex_1.regEx)(/^v/), '');
        const releaseChecksumAssetName = digestAsset.assetName.replace(current, next);
        const releaseAsset = release.assets.find((a) => a.name === releaseChecksumAssetName);
        if (!releaseAsset) {
            return null;
        }
        if (digestAsset.digestedFileName) {
            const releaseFilename = digestAsset.digestedFileName.replace(current, next);
            const res = await this.http.get(releaseAsset.browser_download_url);
            for (const line of res.body.split(regex_1.newlineRegex)) {
                const [lineDigest, lineFn] = line.split((0, regex_1.regEx)(/\s+/), 2);
                if (lineFn === releaseFilename) {
                    return lineDigest;
                }
            }
        }
        else {
            const algorithm = inferHashAlg(digestAsset.currentDigest);
            const newDigest = await this.downloadAndDigest(releaseAsset, algorithm);
            return newDigest;
        }
        return null;
    }
    async getDigest({ packageName: repo, currentValue, currentDigest, registryUrl, }, newValue) {
        logger_1.logger.debug({ repo, currentValue, currentDigest, registryUrl, newValue }, 'getDigest');
        if (!currentDigest) {
            return null;
        }
        if (!currentValue) {
            return currentDigest;
        }
        const apiBaseUrl = (0, common_1.getApiBaseUrl)(registryUrl);
        const { body: currentRelease } = await this.http.getJson(`${apiBaseUrl}repos/${repo}/releases/tags/${currentValue}`);
        const digestAsset = await this.findDigestAsset(currentRelease, currentDigest);
        let newDigest;
        if (!digestAsset || newValue === currentValue) {
            newDigest = currentDigest;
        }
        else {
            const { body: newRelease } = await this.http.getJson(`${apiBaseUrl}repos/${repo}/releases/tags/${newValue}`);
            newDigest = await this.mapDigestAssetToRelease(digestAsset, newRelease);
        }
        return newDigest;
    }
    /**
     * github.getReleases
     *
     * This function can be used to fetch releases with a customisable versioning (e.g. semver) and with releases.
     *
     * This function will:
     *  - Fetch all releases
     *  - Sanitize the versions if desired (e.g. strip out leading 'v')
     *  - Return a dependency object containing sourceUrl string and releases array
     */
    async getReleases(config) {
        const releases = await this.releasesCache.getItems(config);
        return {
            sourceUrl: (0, common_1.getSourceUrl)(config.packageName, config.registryUrl),
            releases: releases.map((item) => {
                const { version, releaseTimestamp, isStable } = item;
                const result = {
                    version,
                    gitRef: version,
                    releaseTimestamp,
                };
                if (isStable !== undefined) {
                    result.isStable = isStable;
                }
                return result;
            }),
        };
    }
}
GithubReleasesDatasource.id = 'github-releases';
tslib_1.__decorate([
    (0, decorator_1.cache)({
        ttlMinutes: 1440,
        namespace: 'datasource-github-releases',
        key: (asset, algorithm) => `${asset.browser_download_url}:${algorithm}:assetDigest`,
    })
], GithubReleasesDatasource.prototype, "downloadAndDigest", null);
tslib_1.__decorate([
    (0, decorator_1.cache)({
        ttlMinutes: 1440,
        namespace: 'datasource-github-releases',
        key: ({ packageName: repo, currentValue, currentDigest, registryUrl, }, newValue) => `${registryUrl}:${repo}:${currentValue}:${currentDigest}:${newValue}:digest`,
    })
], GithubReleasesDatasource.prototype, "getDigest", null);
exports.GithubReleasesDatasource = GithubReleasesDatasource;
//# sourceMappingURL=index.js.map