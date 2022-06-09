"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DockerDatasource = exports.defaultConfig = exports.isECRMaxResultsError = exports.extractDigestFromResponseBody = exports.getRegistryRepository = exports.getAuthHeaders = exports.ecrRegex = exports.DOCKER_HUB = void 0;
const tslib_1 = require("tslib");
const url_1 = tslib_1.__importDefault(require("url"));
const client_ecr_1 = require("@aws-sdk/client-ecr");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const auth_header_1 = require("auth-header");
const hasha_1 = tslib_1.__importDefault(require("hasha"));
const error_messages_1 = require("../../../constants/error-messages");
const logger_1 = require("../../../logger");
const external_host_error_1 = require("../../../types/errors/external-host-error");
const decorator_1 = require("../../../util/cache/package/decorator");
const hostRules = tslib_1.__importStar(require("../../../util/host-rules"));
const http_1 = require("../../../util/http");
const object_1 = require("../../../util/object");
const regex_1 = require("../../../util/regex");
const url_2 = require("../../../util/url");
const docker_1 = require("../../versioning/docker");
const datasource_1 = require("../datasource");
const common_1 = require("./common");
const types_1 = require("./types");
exports.DOCKER_HUB = 'https://index.docker.io';
exports.ecrRegex = (0, regex_1.regEx)(/\d+\.dkr\.ecr\.([-a-z0-9]+)\.amazonaws\.com/);
function isDockerHost(host) {
    const regex = (0, regex_1.regEx)(/(?:^|\.)docker\.io$/);
    return regex.test(host);
}
async function getAuthHeaders(http, registryHost, dockerRepository, apiCheckUrl = `${registryHost}/v2/`) {
    try {
        // use json request, as this will be cached for tags, so it returns json
        // TODO: add cache test
        const apiCheckResponse = await http.getJson(apiCheckUrl, {
            throwHttpErrors: false,
            noAuth: true,
        });
        if (apiCheckResponse.statusCode === 200) {
            logger_1.logger.debug({ apiCheckUrl }, 'No registry auth required');
            return {};
        }
        if (apiCheckResponse.statusCode !== 401 ||
            !is_1.default.nonEmptyString(apiCheckResponse.headers['www-authenticate'])) {
            logger_1.logger.warn({ apiCheckUrl, res: apiCheckResponse }, 'Invalid registry response');
            return null;
        }
        const authenticateHeader = (0, auth_header_1.parse)(apiCheckResponse.headers['www-authenticate']);
        const opts = hostRules.find({
            hostType: DockerDatasource.id,
            url: apiCheckUrl,
        });
        if (exports.ecrRegex.test(registryHost)) {
            logger_1.logger.trace({ registryHost, dockerRepository }, `Using ecr auth for Docker registry`);
            const [, region] = exports.ecrRegex.exec(registryHost) ?? [];
            const auth = await getECRAuthToken(region, opts);
            if (auth) {
                opts.headers = { authorization: `Basic ${auth}` };
            }
        }
        else if (opts.username && opts.password) {
            logger_1.logger.trace({ registryHost, dockerRepository }, `Using basic auth for Docker registry`);
            const auth = Buffer.from(`${opts.username}:${opts.password}`).toString('base64');
            opts.headers = { authorization: `Basic ${auth}` };
        }
        else if (opts.token) {
            const authType = opts.authType ?? 'Bearer';
            logger_1.logger.trace({ registryHost, dockerRepository }, `Using ${authType} token for Docker registry`);
            opts.headers = { authorization: `${authType} ${opts.token}` };
        }
        delete opts.username;
        delete opts.password;
        delete opts.token;
        // If realm isn't an url, we should directly use auth header
        // Can happen when we get a Basic auth or some other auth type
        // * WWW-Authenticate: Basic realm="Artifactory Realm"
        // * Www-Authenticate: Basic realm="https://123456789.dkr.ecr.eu-central-1.amazonaws.com/",service="ecr.amazonaws.com"
        // * www-authenticate: Bearer realm="https://ghcr.io/token",service="ghcr.io",scope="repository:user/image:pull"
        // * www-authenticate: Bearer realm="https://auth.docker.io/token",service="registry.docker.io"
        if (authenticateHeader.scheme.toUpperCase() !== 'BEARER' ||
            !is_1.default.string(authenticateHeader.params.realm) ||
            !is_1.default.string(authenticateHeader.params.service) ||
            (0, url_2.parseUrl)(authenticateHeader.params.realm) === null) {
            logger_1.logger.trace({ registryHost, dockerRepository, authenticateHeader }, `Invalid realm, testing direct auth`);
            return opts.headers ?? null;
        }
        let scope = `repository:${dockerRepository}:pull`;
        // repo isn't known to server yet, so causing wrong scope `repository:user/image:pull`
        if (is_1.default.string(authenticateHeader.params.scope) &&
            !apiCheckUrl.endsWith('/v2/')) {
            scope = authenticateHeader.params.scope;
        }
        const authUrl = `${authenticateHeader.params.realm}?service=${authenticateHeader.params.service}&scope=${scope}`;
        logger_1.logger.trace({ registryHost, dockerRepository, authUrl }, `Obtaining docker registry token`);
        opts.noAuth = true;
        const authResponse = (await http.getJson(authUrl, opts)).body;
        const token = authResponse.token || authResponse.access_token;
        // istanbul ignore if
        if (!token) {
            logger_1.logger.warn('Failed to obtain docker registry token');
            return null;
        }
        return {
            authorization: `Bearer ${token}`,
        };
    }
    catch (err) /* istanbul ignore next */ {
        if (err.host === 'quay.io') {
            // TODO: debug why quay throws errors (#9604)
            return null;
        }
        if (err.statusCode === 401) {
            logger_1.logger.debug({ registryHost, dockerRepository }, 'Unauthorized docker lookup');
            logger_1.logger.debug({ err });
            return null;
        }
        if (err.statusCode === 403) {
            logger_1.logger.debug({ registryHost, dockerRepository }, 'Not allowed to access docker registry');
            logger_1.logger.debug({ err });
            return null;
        }
        if (err.name === 'RequestError' && isDockerHost(registryHost)) {
            throw new external_host_error_1.ExternalHostError(err);
        }
        if (err.statusCode === 429 && isDockerHost(registryHost)) {
            throw new external_host_error_1.ExternalHostError(err);
        }
        if (err.statusCode >= 500 && err.statusCode < 600) {
            throw new external_host_error_1.ExternalHostError(err);
        }
        if (err.message === error_messages_1.HOST_DISABLED) {
            logger_1.logger.trace({ registryHost, dockerRepository, err }, 'Host disabled');
            return null;
        }
        logger_1.logger.warn({ registryHost, dockerRepository, err }, 'Error obtaining docker token');
        return null;
    }
}
exports.getAuthHeaders = getAuthHeaders;
async function getECRAuthToken(region, opts) {
    const config = { region };
    if (opts.username && opts.password) {
        config.credentials = {
            accessKeyId: opts.username,
            secretAccessKey: opts.password,
            ...(opts.token && { sessionToken: opts.token }),
        };
    }
    const ecr = new client_ecr_1.ECR(config);
    try {
        const data = await ecr.getAuthorizationToken({});
        const authorizationToken = data?.authorizationData?.[0]?.authorizationToken;
        if (authorizationToken) {
            return authorizationToken;
        }
        logger_1.logger.warn('Could not extract authorizationToken from ECR getAuthorizationToken response');
    }
    catch (err) {
        logger_1.logger.trace({ err }, 'err');
        logger_1.logger.debug('ECR getAuthorizationToken error');
    }
    return null;
}
function getRegistryRepository(packageName, registryUrl) {
    if (registryUrl !== exports.DOCKER_HUB) {
        const registryEndingWithSlash = (0, url_2.ensureTrailingSlash)(registryUrl.replace((0, regex_1.regEx)(/^https?:\/\//), ''));
        if (packageName.startsWith(registryEndingWithSlash)) {
            let registryHost = (0, url_2.trimTrailingSlash)(registryUrl);
            if (!(0, regex_1.regEx)(/^https?:\/\//).test(registryHost)) {
                registryHost = `https://${registryHost}`;
            }
            let dockerRepository = packageName.replace(registryEndingWithSlash, '');
            const fullUrl = `${registryHost}/${dockerRepository}`;
            const { origin, pathname } = (0, url_2.parseUrl)(fullUrl);
            registryHost = origin;
            dockerRepository = pathname.substring(1);
            return {
                registryHost,
                dockerRepository,
            };
        }
    }
    let registryHost;
    const split = packageName.split('/');
    if (split.length > 1 && (split[0].includes('.') || split[0].includes(':'))) {
        [registryHost] = split;
        split.shift();
    }
    let dockerRepository = split.join('/');
    if (!registryHost) {
        registryHost = registryUrl.replace('https://docker.io', 'https://index.docker.io');
    }
    if (registryHost === 'docker.io') {
        registryHost = 'index.docker.io';
    }
    if (!(0, regex_1.regEx)(/^https?:\/\//).exec(registryHost)) {
        registryHost = `https://${registryHost}`;
    }
    const opts = hostRules.find({
        hostType: DockerDatasource.id,
        url: registryHost,
    });
    if (opts?.insecureRegistry) {
        registryHost = registryHost.replace('https', 'http');
    }
    if (registryHost.endsWith('.docker.io') && !dockerRepository.includes('/')) {
        dockerRepository = 'library/' + dockerRepository;
    }
    return {
        registryHost,
        dockerRepository,
    };
}
exports.getRegistryRepository = getRegistryRepository;
function digestFromManifestStr(str) {
    return 'sha256:' + (0, hasha_1.default)(str, { algorithm: 'sha256' });
}
function extractDigestFromResponseBody(manifestResponse) {
    return digestFromManifestStr(manifestResponse.body);
}
exports.extractDigestFromResponseBody = extractDigestFromResponseBody;
function isECRMaxResultsError(err) {
    const resp = err.response;
    return !!(resp?.statusCode === 405 &&
        resp.headers?.['docker-distribution-api-version'] &&
        // https://docs.aws.amazon.com/AmazonECR/latest/APIReference/API_DescribeRepositories.html#ECR-DescribeRepositories-request-maxResults
        resp.body?.['errors']?.[0]?.message?.includes('Member must have value less than or equal to 1000'));
}
exports.isECRMaxResultsError = isECRMaxResultsError;
exports.defaultConfig = {
    commitMessageTopic: '{{{depName}}} Docker tag',
    commitMessageExtra: 'to v{{#if isMajor}}{{{newMajor}}}{{else}}{{{newVersion}}}{{/if}}',
    digest: {
        branchTopic: '{{{depNameSanitized}}}-{{{currentValue}}}',
        commitMessageExtra: 'to {{newDigestShort}}',
        commitMessageTopic: '{{{depName}}}{{#if currentValue}}:{{{currentValue}}}{{/if}} Docker digest',
        group: {
            commitMessageTopic: '{{{groupName}}}',
            commitMessageExtra: '',
        },
    },
    pin: {
        commitMessageExtra: '',
        groupName: 'Docker digests',
        group: {
            commitMessageTopic: '{{{groupName}}}',
            branchTopic: 'digests-pin',
        },
    },
    group: {
        commitMessageTopic: '{{{groupName}}} Docker tags',
    },
};
function findLatestStable(tags) {
    const versions = tags
        .filter((v) => docker_1.api.isValid(v) && docker_1.api.isStable(v))
        .sort((a, b) => docker_1.api.sortVersions(a, b));
    return versions.pop() ?? tags.slice(-1).pop() ?? null;
}
class DockerDatasource extends datasource_1.Datasource {
    constructor() {
        super(DockerDatasource.id);
        this.defaultVersioning = docker_1.id;
        this.defaultRegistryUrls = [exports.DOCKER_HUB];
    }
    // TODO: debug why quay throws errors (#9612)
    async getManifestResponse(registryHost, dockerRepository, tag, mode = 'get') {
        logger_1.logger.debug(`getManifestResponse(${registryHost}, ${dockerRepository}, ${tag})`);
        try {
            const headers = await getAuthHeaders(this.http, registryHost, dockerRepository);
            if (!headers) {
                logger_1.logger.debug('No docker auth found - returning');
                return null;
            }
            headers.accept = [
                types_1.MediaType.manifestListV2,
                types_1.MediaType.manifestV2,
                types_1.MediaType.ociManifestV1,
                types_1.MediaType.ociManifestIndexV1,
            ].join(', ');
            const url = `${registryHost}/v2/${dockerRepository}/manifests/${tag}`;
            const manifestResponse = await this.http[mode](url, {
                headers,
                noAuth: true,
            });
            return manifestResponse;
        }
        catch (err) /* istanbul ignore next */ {
            if (err instanceof external_host_error_1.ExternalHostError) {
                throw err;
            }
            if (err.statusCode === 401) {
                logger_1.logger.debug({ registryHost, dockerRepository }, 'Unauthorized docker lookup');
                logger_1.logger.debug({ err });
                return null;
            }
            if (err.statusCode === 404) {
                logger_1.logger.debug({
                    err,
                    registryHost,
                    dockerRepository,
                    tag,
                }, 'Docker Manifest is unknown');
                return null;
            }
            if (err.statusCode === 429 && isDockerHost(registryHost)) {
                throw new external_host_error_1.ExternalHostError(err);
            }
            if (err.statusCode >= 500 && err.statusCode < 600) {
                throw new external_host_error_1.ExternalHostError(err);
            }
            if (err.code === 'ETIMEDOUT') {
                logger_1.logger.debug({ registryHost }, 'Timeout when attempting to connect to docker registry');
                logger_1.logger.debug({ err });
                return null;
            }
            logger_1.logger.debug({
                err,
                registryHost,
                dockerRepository,
                tag,
            }, 'Unknown Error looking up docker manifest');
            return null;
        }
    }
    async getConfigDigest(registry, dockerRepository, tag) {
        const manifestResponse = await this.getManifestResponse(registry, dockerRepository, tag);
        // If getting the manifest fails here, then abort
        // This means that the latest tag doesn't have a manifest, which shouldn't
        // be possible
        // istanbul ignore if
        if (!manifestResponse) {
            return null;
        }
        const manifest = JSON.parse(manifestResponse.body);
        if (manifest.schemaVersion !== 2) {
            logger_1.logger.debug({ registry, dockerRepository, tag }, 'Manifest schema version is not 2');
            return null;
        }
        if (manifest.mediaType === types_1.MediaType.manifestListV2) {
            if (manifest.manifests.length) {
                logger_1.logger.trace({ registry, dockerRepository, tag }, 'Found manifest list, using first image');
                return this.getConfigDigest(registry, dockerRepository, manifest.manifests[0].digest);
            }
            else {
                logger_1.logger.debug({ manifest }, 'Invalid manifest list with no manifests - returning');
                return null;
            }
        }
        if (manifest.mediaType === types_1.MediaType.manifestV2 &&
            is_1.default.string(manifest.config?.digest)) {
            return manifest.config?.digest;
        }
        // OCI image lists are not required to specify a mediaType
        if (manifest.mediaType === types_1.MediaType.ociManifestIndexV1 ||
            (!manifest.mediaType && (0, object_1.hasKey)('manifests', manifest))) {
            const imageList = manifest;
            if (imageList.manifests.length) {
                logger_1.logger.trace({ registry, dockerRepository, tag }, 'Found manifest index, using first image');
                return this.getConfigDigest(registry, dockerRepository, manifest.manifests[0].digest);
            }
            else {
                logger_1.logger.debug({ manifest }, 'Invalid manifest index with no manifests - returning');
                return null;
            }
        }
        // OCI manifests are not required to specify a mediaType
        if ((manifest.mediaType === types_1.MediaType.ociManifestV1 ||
            (!manifest.mediaType && (0, object_1.hasKey)('config', manifest))) &&
            is_1.default.string(manifest.config?.digest)) {
            return manifest.config?.digest;
        }
        logger_1.logger.debug({ manifest }, 'Invalid manifest - returning');
        return null;
    }
    /*
     * docker.getLabels
     *
     * This function will:
     *  - Return the labels for the requested image
     */
    async getLabels(registryHost, dockerRepository, tag) {
        logger_1.logger.debug(`getLabels(${registryHost}, ${dockerRepository}, ${tag})`);
        try {
            let labels = {};
            const configDigest = await this.getConfigDigest(registryHost, dockerRepository, tag);
            if (!configDigest) {
                return {};
            }
            const headers = await getAuthHeaders(this.http, registryHost, dockerRepository);
            // istanbul ignore if: Should never be happen
            if (!headers) {
                logger_1.logger.debug('No docker auth found - returning');
                return {};
            }
            const url = `${registryHost}/v2/${dockerRepository}/blobs/${configDigest}`;
            const configResponse = await this.http.get(url, {
                headers,
                noAuth: true,
            });
            labels = JSON.parse(configResponse.body).config.Labels;
            if (labels) {
                logger_1.logger.debug({
                    labels,
                }, 'found labels in manifest');
            }
            return labels;
        }
        catch (err) /* istanbul ignore next: should be tested in future */ {
            if (err instanceof external_host_error_1.ExternalHostError) {
                throw err;
            }
            if (err.statusCode === 400 || err.statusCode === 401) {
                logger_1.logger.debug({ registryHost, dockerRepository, err }, 'Unauthorized docker lookup');
            }
            else if (err.statusCode === 404) {
                logger_1.logger.warn({
                    err,
                    registryHost,
                    dockerRepository,
                    tag,
                }, 'Config Manifest is unknown');
            }
            else if (err.statusCode === 429 && isDockerHost(registryHost)) {
                logger_1.logger.warn({ err }, 'docker registry failure: too many requests');
            }
            else if (err.statusCode >= 500 && err.statusCode < 600) {
                logger_1.logger.debug({
                    err,
                    registryHost,
                    dockerRepository,
                    tag,
                }, 'docker registry failure: internal error');
            }
            else if (err.code === 'ERR_TLS_CERT_ALTNAME_INVALID' ||
                err.code === 'ETIMEDOUT') {
                logger_1.logger.debug({ registryHost, err }, 'Error connecting to docker registry');
            }
            else if (registryHost === 'https://quay.io') {
                // istanbul ignore next
                logger_1.logger.debug('Ignoring quay.io errors until they fully support v2 schema');
            }
            else {
                logger_1.logger.info({ registryHost, dockerRepository, tag, err }, 'Unknown error getting Docker labels');
            }
            return {};
        }
    }
    async getTagsQuayRegistry(registry, repository) {
        let tags = [];
        const limit = 100;
        const pageUrl = (page) => `${registry}/api/v1/repository/${repository}/tag/?limit=${limit}&page=${page}&onlyActiveTags=true`;
        let page = 1;
        let url = pageUrl(page);
        while (url && page <= 20) {
            // typescript issue :-/
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            const res = (await this.http.getJson(url));
            const pageTags = res.body.tags.map((tag) => tag.name);
            tags = tags.concat(pageTags);
            page += 1;
            url = res.body.has_additional ? pageUrl(page) : null;
        }
        return tags;
    }
    async getDockerApiTags(registryHost, dockerRepository) {
        let tags = [];
        // AWS ECR limits the maximum number of results to 1000
        // See https://docs.aws.amazon.com/AmazonECR/latest/APIReference/API_DescribeRepositories.html#ECR-DescribeRepositories-request-maxResults
        const limit = exports.ecrRegex.test(registryHost) ? 1000 : 10000;
        let url = `${registryHost}/${dockerRepository}/tags/list?n=${limit}`;
        url = (0, url_2.ensurePathPrefix)(url, '/v2');
        const headers = await getAuthHeaders(this.http, registryHost, dockerRepository, url);
        if (!headers) {
            logger_1.logger.debug('Failed to get authHeaders for getTags lookup');
            return null;
        }
        let page = 1;
        let foundMaxResultsError = false;
        do {
            let res;
            try {
                res = await this.http.getJson(url, {
                    headers,
                    noAuth: true,
                });
            }
            catch (err) {
                if (!foundMaxResultsError &&
                    err instanceof http_1.HttpError &&
                    isECRMaxResultsError(err)) {
                    const maxResults = 1000;
                    url = `${registryHost}/${dockerRepository}/tags/list?n=${maxResults}`;
                    url = (0, url_2.ensurePathPrefix)(url, '/v2');
                    foundMaxResultsError = true;
                    continue;
                }
                throw err;
            }
            tags = tags.concat(res.body.tags);
            const linkHeader = (0, url_2.parseLinkHeader)(res.headers.link);
            url = linkHeader?.next ? url_1.default.resolve(url, linkHeader.next.url) : null;
            page += 1;
        } while (url && page < 20);
        return tags;
    }
    async getTags(registryHost, dockerRepository) {
        try {
            const isQuay = (0, regex_1.regEx)(/^https:\/\/quay\.io(?::[1-9][0-9]{0,4})?$/i).test(registryHost);
            let tags;
            if (isQuay) {
                tags = await this.getTagsQuayRegistry(registryHost, dockerRepository);
            }
            else {
                tags = await this.getDockerApiTags(registryHost, dockerRepository);
            }
            return tags;
        }
        catch (err) /* istanbul ignore next */ {
            if (err instanceof external_host_error_1.ExternalHostError) {
                throw err;
            }
            if (err.statusCode === 404 && !dockerRepository.includes('/')) {
                logger_1.logger.debug(`Retrying Tags for ${registryHost}/${dockerRepository} using library/ prefix`);
                return this.getTags(registryHost, 'library/' + dockerRepository);
            }
            // prettier-ignore
            if (err.statusCode === 429 && isDockerHost(registryHost)) {
                logger_1.logger.warn({ registryHost, dockerRepository, err }, 'docker registry failure: too many requests');
                throw new external_host_error_1.ExternalHostError(err);
            }
            // prettier-ignore
            if (err.statusCode === 401 && isDockerHost(registryHost)) {
                logger_1.logger.warn({ registryHost, dockerRepository, err }, 'docker registry failure: unauthorized');
                throw new external_host_error_1.ExternalHostError(err);
            }
            if (err.statusCode >= 500 && err.statusCode < 600) {
                logger_1.logger.warn({ registryHost, dockerRepository, err }, 'docker registry failure: internal error');
                throw new external_host_error_1.ExternalHostError(err);
            }
            throw err;
        }
    }
    /**
     * docker.getDigest
     *
     * The `newValue` supplied here should be a valid tag for the docker image.
     *
     * This function will:
     *  - Look up a sha256 digest for a tag on its registry
     *  - Return the digest as a string
     */
    async getDigest({ registryUrl, packageName }, newValue) {
        const { registryHost, dockerRepository } = getRegistryRepository(packageName, 
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        registryUrl);
        logger_1.logger.debug(`getDigest(${registryHost}, ${dockerRepository}, ${newValue})`);
        const newTag = newValue || 'latest';
        let digest = null;
        try {
            let manifestResponse = await this.getManifestResponse(registryHost, dockerRepository, newTag, 'head');
            if (manifestResponse) {
                if ((0, object_1.hasKey)('docker-content-digest', manifestResponse.headers)) {
                    digest =
                        manifestResponse.headers['docker-content-digest'] ||
                            null;
                }
                else {
                    logger_1.logger.debug({ registryHost }, 'Missing docker content digest header, pulling full manifest');
                    manifestResponse = await this.getManifestResponse(registryHost, dockerRepository, newTag);
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                    digest = extractDigestFromResponseBody(manifestResponse);
                }
                logger_1.logger.debug({ digest }, 'Got docker digest');
            }
        }
        catch (err) /* istanbul ignore next */ {
            if (err instanceof external_host_error_1.ExternalHostError) {
                throw err;
            }
            logger_1.logger.debug({
                err,
                packageName,
                newTag,
            }, 'Unknown Error looking up docker image digest');
        }
        return digest;
    }
    /**
     * docker.getReleases
     *
     * A docker image usually looks something like this: somehost.io/owner/repo:8.1.0-alpine
     * In the above:
     *  - 'somehost.io' is the registry
     *  - 'owner/repo' is the package name
     *  - '8.1.0-alpine' is the tag
     *
     * This function will filter only tags that contain a semver version
     */
    async getReleases({ packageName, registryUrl, }) {
        const { registryHost, dockerRepository } = getRegistryRepository(packageName, 
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        registryUrl);
        const tags = await this.getTags(registryHost, dockerRepository);
        if (!tags) {
            return null;
        }
        const releases = tags.map((version) => ({ version }));
        const ret = {
            registryUrl: registryHost,
            releases,
        };
        const latestTag = tags.includes('latest')
            ? 'latest'
            : findLatestStable(tags);
        // istanbul ignore if: needs test
        if (!latestTag) {
            return ret;
        }
        const labels = await this.getLabels(registryHost, dockerRepository, latestTag);
        if (labels) {
            for (const label of common_1.sourceLabels) {
                if (is_1.default.nonEmptyString(labels[label])) {
                    ret.sourceUrl = labels[label];
                    break;
                }
            }
        }
        return ret;
    }
}
DockerDatasource.id = 'docker';
tslib_1.__decorate([
    (0, decorator_1.cache)({
        namespace: 'datasource-docker-labels',
        key: (registryHost, dockerRepository, tag) => `${registryHost}:${dockerRepository}:${tag}`,
        ttlMinutes: 60,
    })
], DockerDatasource.prototype, "getLabels", null);
tslib_1.__decorate([
    (0, decorator_1.cache)({
        namespace: 'datasource-docker-tags',
        key: (registryHost, dockerRepository) => `${registryHost}:${dockerRepository}`,
    })
], DockerDatasource.prototype, "getTags", null);
tslib_1.__decorate([
    (0, decorator_1.cache)({
        namespace: 'datasource-docker-digest',
        key: ({ registryUrl, packageName }, newValue) => {
            const newTag = newValue || 'latest';
            const { registryHost, dockerRepository } = getRegistryRepository(packageName, 
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            registryUrl);
            return `${registryHost}:${dockerRepository}:${newTag}`;
        },
    })
], DockerDatasource.prototype, "getDigest", null);
exports.DockerDatasource = DockerDatasource;
//# sourceMappingURL=index.js.map