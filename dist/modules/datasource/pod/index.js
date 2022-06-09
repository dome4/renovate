"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PodDatasource = void 0;
const tslib_1 = require("tslib");
const crypto_1 = tslib_1.__importDefault(require("crypto"));
const error_messages_1 = require("../../../constants/error-messages");
const logger_1 = require("../../../logger");
const external_host_error_1 = require("../../../types/errors/external-host-error");
const decorator_1 = require("../../../util/cache/package/decorator");
const github_1 = require("../../../util/http/github");
const regex_1 = require("../../../util/regex");
const datasource_1 = require("../datasource");
const metadata_1 = require("../metadata");
// eslint-disable-next-line typescript-enum/no-enum, typescript-enum/no-const-enum
var URLFormatOptions;
(function (URLFormatOptions) {
    URLFormatOptions[URLFormatOptions["WithShardWithSpec"] = 0] = "WithShardWithSpec";
    URLFormatOptions[URLFormatOptions["WithShardWithoutSpec"] = 1] = "WithShardWithoutSpec";
    URLFormatOptions[URLFormatOptions["WithSpecsWithoutShard"] = 2] = "WithSpecsWithoutShard";
    URLFormatOptions[URLFormatOptions["WithoutSpecsWithoutShard"] = 3] = "WithoutSpecsWithoutShard";
})(URLFormatOptions || (URLFormatOptions = {}));
function shardParts(packageName) {
    return crypto_1.default
        .createHash('md5')
        .update(packageName)
        .digest('hex')
        .slice(0, 3)
        .split('');
}
const githubRegex = (0, regex_1.regEx)(/(?<hostURL>(^https:\/\/[a-zA-z0-9-.]+))\/(?<account>[^/]+)\/(?<repo>[^/]+?)(\.git|\/.*)?$/);
function releasesGithubUrl(packageName, opts) {
    const { hostURL, account, repo, useShard, useSpecs } = opts;
    const prefix = hostURL && hostURL !== 'https://github.com'
        ? `${hostURL}/api/v3/repos`
        : 'https://api.github.com/repos';
    const shard = shardParts(packageName).join('/');
    // `Specs` in the pods repo URL is a new requirement for legacy support also allow pod repo URL without `Specs`
    const packageNamePath = useSpecs ? `Specs/${packageName}` : packageName;
    const shardPath = useSpecs
        ? `Specs/${shard}/${packageName}`
        : `${shard}/${packageName}`;
    const suffix = useShard ? shardPath : packageNamePath;
    return `${prefix}/${account}/${repo}/contents/${suffix}`;
}
function handleError(packageName, err) {
    const errorData = { packageName, err };
    const statusCode = err.response?.statusCode ?? 0;
    if (statusCode === 429 || (statusCode >= 500 && statusCode < 600)) {
        logger_1.logger.warn({ packageName, err }, `CocoaPods registry failure`);
        throw new external_host_error_1.ExternalHostError(err);
    }
    if (statusCode === 401) {
        logger_1.logger.debug(errorData, 'Authorization error');
    }
    else if (statusCode === 404) {
        logger_1.logger.debug(errorData, 'Package lookup error');
    }
    else if (err.message === error_messages_1.HOST_DISABLED) {
        // istanbul ignore next
        logger_1.logger.trace(errorData, 'Host disabled');
    }
    else {
        logger_1.logger.warn(errorData, 'CocoaPods lookup failure: Unknown error');
    }
}
function isDefaultRepo(url) {
    const match = githubRegex.exec(url);
    if (match) {
        const { account, repo } = match.groups ?? {};
        return (account.toLowerCase() === 'cocoapods' && repo.toLowerCase() === 'specs'); // https://github.com/CocoaPods/Specs.git
    }
    return false;
}
function releasesCDNUrl(packageName, registryUrl) {
    const shard = shardParts(packageName).join('_');
    return `${registryUrl}/all_pods_versions_${shard}.txt`;
}
class PodDatasource extends datasource_1.Datasource {
    constructor() {
        super(PodDatasource.id);
        this.defaultRegistryUrls = ['https://cdn.cocoapods.org'];
        this.registryStrategy = 'hunt';
        this.githubHttp = new github_1.GithubHttp(PodDatasource.id);
    }
    async requestCDN(url, packageName) {
        try {
            const resp = await this.http.get(url);
            if (resp?.body) {
                return resp.body;
            }
        }
        catch (err) {
            handleError(packageName, err);
        }
        return null;
    }
    async requestGithub(url, packageName) {
        try {
            const resp = await this.githubHttp.getJson(url);
            if (resp?.body) {
                return resp.body;
            }
        }
        catch (err) {
            handleError(packageName, err);
        }
        return null;
    }
    async getReleasesFromGithub(packageName, opts, useShard = true, useSpecs = true, urlFormatOptions = URLFormatOptions.WithShardWithSpec) {
        const url = releasesGithubUrl(packageName, { ...opts, useShard, useSpecs });
        const resp = await this.requestGithub(url, packageName);
        if (resp) {
            const releases = resp.map(({ name }) => ({ version: name }));
            return { releases };
        }
        // iterating through enum to support different url formats
        switch (urlFormatOptions) {
            case URLFormatOptions.WithShardWithSpec:
                return this.getReleasesFromGithub(packageName, opts, true, false, URLFormatOptions.WithShardWithoutSpec);
            case URLFormatOptions.WithShardWithoutSpec:
                return this.getReleasesFromGithub(packageName, opts, false, true, URLFormatOptions.WithSpecsWithoutShard);
            case URLFormatOptions.WithSpecsWithoutShard:
                return this.getReleasesFromGithub(packageName, opts, false, false, URLFormatOptions.WithoutSpecsWithoutShard);
            case URLFormatOptions.WithoutSpecsWithoutShard:
            default:
                return null;
        }
    }
    async getReleasesFromCDN(packageName, registryUrl) {
        const url = releasesCDNUrl(packageName, registryUrl);
        const resp = await this.requestCDN(url, packageName);
        if (resp) {
            const lines = resp.split(regex_1.newlineRegex);
            for (let idx = 0; idx < lines.length; idx += 1) {
                const line = lines[idx];
                const [name, ...versions] = line.split('/');
                if (name === packageName.replace((0, regex_1.regEx)(/\/.*$/), '')) {
                    const releases = versions.map((version) => ({ version }));
                    return { releases };
                }
            }
        }
        return null;
    }
    async getReleases({ packageName, registryUrl, }) {
        // istanbul ignore if
        if (!registryUrl) {
            return null;
        }
        const podName = packageName.replace((0, regex_1.regEx)(/\/.*$/), '');
        let baseUrl = registryUrl.replace((0, regex_1.regEx)(/\/+$/), '');
        // In order to not abuse github API limits, query CDN instead
        if (isDefaultRepo(baseUrl)) {
            [baseUrl] = this.defaultRegistryUrls;
        }
        let result = null;
        const match = githubRegex.exec(baseUrl);
        if (match) {
            baseUrl = (0, metadata_1.massageGithubUrl)(baseUrl);
            const { hostURL, account, repo } = match?.groups ?? {};
            const opts = { hostURL, account, repo };
            result = await this.getReleasesFromGithub(podName, opts);
        }
        else {
            result = await this.getReleasesFromCDN(podName, baseUrl);
        }
        return result;
    }
}
PodDatasource.id = 'pod';
tslib_1.__decorate([
    (0, decorator_1.cache)({
        ttlMinutes: 30,
        namespace: `datasource-${PodDatasource.id}`,
        key: ({ packageName, registryUrl }) => `${registryUrl}:${packageName}`,
    })
], PodDatasource.prototype, "getReleases", null);
exports.PodDatasource = PodDatasource;
//# sourceMappingURL=index.js.map