"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultConfig = exports.getDigest = exports.supportsDigests = exports.getPkgReleases = exports.getDefaultVersioning = exports.getDatasourceList = exports.getDatasources = exports.isGetPkgReleasesConfig = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const dequal_1 = require("dequal");
const error_messages_1 = require("../../constants/error-messages");
const logger_1 = require("../../logger");
const external_host_error_1 = require("../../types/errors/external-host-error");
const memCache = tslib_1.__importStar(require("../../util/cache/memory"));
const packageCache = tslib_1.__importStar(require("../../util/cache/package"));
const clone_1 = require("../../util/clone");
const regex_1 = require("../../util/regex");
const url_1 = require("../../util/url");
const allVersioning = tslib_1.__importStar(require("../versioning"));
const api_1 = tslib_1.__importDefault(require("./api"));
const metadata_1 = require("./metadata");
const npm_1 = require("./npm");
const npmrc_1 = require("./npm/npmrc");
tslib_1.__exportStar(require("./types"), exports);
var common_1 = require("./common");
Object.defineProperty(exports, "isGetPkgReleasesConfig", { enumerable: true, get: function () { return common_1.isGetPkgReleasesConfig; } });
const getDatasources = () => api_1.default;
exports.getDatasources = getDatasources;
const getDatasourceList = () => Array.from(api_1.default.keys());
exports.getDatasourceList = getDatasourceList;
const cacheNamespace = 'datasource-releases';
function getDatasourceFor(datasource) {
    return api_1.default.get(datasource) ?? null;
}
// TODO: fix error Type
function logError(datasource, packageName, err) {
    const { statusCode, code: errCode, url } = err;
    if (statusCode === 404) {
        logger_1.logger.debug({ datasource, packageName, url }, 'Datasource 404');
    }
    else if (statusCode === 401 || statusCode === 403) {
        logger_1.logger.debug({ datasource, packageName, url }, 'Datasource unauthorized');
    }
    else if (errCode) {
        logger_1.logger.debug({ datasource, packageName, url, errCode }, 'Datasource connection error');
    }
    else {
        logger_1.logger.debug({ datasource, packageName, err }, 'Datasource unknown error');
    }
}
async function getRegistryReleases(datasource, config, registryUrl) {
    const cacheKey = `${datasource.id} ${registryUrl} ${config.packageName}`;
    if (datasource.caching) {
        const cachedResult = await packageCache.get(cacheNamespace, cacheKey);
        // istanbul ignore if
        if (cachedResult) {
            logger_1.logger.trace({ cacheKey }, 'Returning cached datasource response');
            return cachedResult;
        }
    }
    const res = await datasource.getReleases({ ...config, registryUrl });
    if (res?.releases.length) {
        res.registryUrl ?? (res.registryUrl = registryUrl);
    }
    // cache non-null responses unless marked as private
    if (datasource.caching && res && !res.isPrivate) {
        logger_1.logger.trace({ cacheKey }, 'Caching datasource response');
        const cacheMinutes = 15;
        await packageCache.set(cacheNamespace, cacheKey, res, cacheMinutes);
    }
    return res;
}
function firstRegistry(config, datasource, registryUrls) {
    if (registryUrls.length > 1) {
        logger_1.logger.warn({ datasource: datasource.id, depName: config.depName, registryUrls }, 'Excess registryUrls found for datasource lookup - using first configured only');
    }
    const registryUrl = registryUrls[0];
    return getRegistryReleases(datasource, config, registryUrl);
}
async function huntRegistries(config, datasource, registryUrls) {
    let res = null;
    let caughtError;
    for (const registryUrl of registryUrls) {
        try {
            res = await getRegistryReleases(datasource, config, registryUrl);
            if (res) {
                break;
            }
        }
        catch (err) {
            if (err instanceof external_host_error_1.ExternalHostError) {
                throw err;
            }
            // We'll always save the last-thrown error
            caughtError = err;
            logger_1.logger.trace({ err }, 'datasource hunt failure');
        }
    }
    if (res) {
        return res;
    }
    if (caughtError) {
        throw caughtError;
    }
    return null;
}
async function mergeRegistries(config, datasource, registryUrls) {
    let combinedRes;
    let caughtError;
    for (const registryUrl of registryUrls) {
        try {
            const res = await getRegistryReleases(datasource, config, registryUrl);
            if (res) {
                if (combinedRes) {
                    for (const existingRelease of combinedRes.releases || []) {
                        existingRelease.registryUrl = combinedRes.registryUrl;
                    }
                    for (const additionalRelease of res.releases || []) {
                        additionalRelease.registryUrl = res.registryUrl;
                    }
                    combinedRes = { ...res, ...combinedRes };
                    delete combinedRes.registryUrl;
                    combinedRes.releases = [...combinedRes.releases, ...res.releases];
                }
                else {
                    combinedRes = res;
                }
            }
        }
        catch (err) {
            if (err instanceof external_host_error_1.ExternalHostError) {
                throw err;
            }
            // We'll always save the last-thrown error
            caughtError = err;
            logger_1.logger.trace({ err }, 'datasource merge failure');
        }
    }
    // De-duplicate releases
    if (combinedRes?.releases?.length) {
        const seenVersions = new Set();
        combinedRes.releases = combinedRes.releases.filter((release) => {
            if (seenVersions.has(release.version)) {
                return false;
            }
            seenVersions.add(release.version);
            return true;
        });
    }
    if (combinedRes) {
        return combinedRes;
    }
    if (caughtError) {
        throw caughtError;
    }
    return null;
}
function massageRegistryUrls(registryUrls) {
    return registryUrls.filter(Boolean).map(url_1.trimTrailingSlash);
}
function resolveRegistryUrls(datasource, defaultRegistryUrls, registryUrls, additionalRegistryUrls) {
    if (!datasource.customRegistrySupport) {
        if (is_1.default.nonEmptyArray(registryUrls) ||
            is_1.default.nonEmptyArray(defaultRegistryUrls) ||
            is_1.default.nonEmptyArray(additionalRegistryUrls)) {
            logger_1.logger.warn({
                datasource: datasource.id,
                registryUrls,
                defaultRegistryUrls,
                additionalRegistryUrls,
            }, 'Custom registries are not allowed for this datasource and will be ignored');
        }
        return datasource.defaultRegistryUrls ?? [];
    }
    const customUrls = registryUrls?.filter(Boolean);
    let resolvedUrls = [];
    if (is_1.default.nonEmptyArray(customUrls)) {
        resolvedUrls = [...customUrls];
    }
    else if (is_1.default.nonEmptyArray(defaultRegistryUrls)) {
        resolvedUrls = [...defaultRegistryUrls];
        resolvedUrls.concat(additionalRegistryUrls ?? []);
    }
    else if (is_1.default.nonEmptyArray(datasource.defaultRegistryUrls)) {
        resolvedUrls = [...datasource.defaultRegistryUrls];
        resolvedUrls.concat(additionalRegistryUrls ?? []);
    }
    return massageRegistryUrls(resolvedUrls);
}
function getDefaultVersioning(datasourceName) {
    const datasource = getDatasourceFor(datasourceName);
    // istanbul ignore if: wrong regex manager config?
    if (!datasource) {
        logger_1.logger.warn({ datasourceName }, 'Missing datasource!');
    }
    return datasource?.defaultVersioning || 'semver';
}
exports.getDefaultVersioning = getDefaultVersioning;
function applyReplacements(config) {
    if (config.replacementName && config.replacementVersion) {
        return {
            replacementName: config.replacementName,
            replacementVersion: config.replacementVersion,
        };
    }
    return undefined;
}
async function fetchReleases(config) {
    const { datasource: datasourceName } = config;
    let { registryUrls } = config;
    // istanbul ignore if: need test
    if (!datasourceName || getDatasourceFor(datasourceName) === undefined) {
        logger_1.logger.warn('Unknown datasource: ' + datasourceName);
        return null;
    }
    if (datasourceName === 'npm') {
        if (is_1.default.string(config.npmrc)) {
            (0, npm_1.setNpmrc)(config.npmrc);
        }
        if (!is_1.default.nonEmptyArray(registryUrls)) {
            registryUrls = [(0, npmrc_1.resolveRegistryUrl)(config.packageName)];
        }
    }
    const datasource = getDatasourceFor(datasourceName);
    // istanbul ignore if: needs test
    if (!datasource) {
        return null;
    }
    registryUrls = resolveRegistryUrls(datasource, config.defaultRegistryUrls, registryUrls, config.additionalRegistryUrls);
    let dep = null;
    const registryStrategy = datasource.registryStrategy || 'hunt';
    try {
        if (is_1.default.nonEmptyArray(registryUrls)) {
            if (registryStrategy === 'first') {
                dep = await firstRegistry(config, datasource, registryUrls);
            }
            else if (registryStrategy === 'hunt') {
                dep = await huntRegistries(config, datasource, registryUrls);
            }
            else if (registryStrategy === 'merge') {
                dep = await mergeRegistries(config, datasource, registryUrls);
            }
        }
        else {
            dep = await datasource.getReleases(config);
        }
    }
    catch (err) {
        if (err.message === error_messages_1.HOST_DISABLED || err.err?.message === error_messages_1.HOST_DISABLED) {
            return null;
        }
        if (err instanceof external_host_error_1.ExternalHostError) {
            throw err;
        }
        logError(datasource.id, config.packageName, err);
    }
    if (!dep || (0, dequal_1.dequal)(dep, { releases: [] })) {
        return null;
    }
    (0, metadata_1.addMetaData)(dep, datasourceName, config.packageName);
    dep = { ...dep, ...applyReplacements(config) };
    return dep;
}
function getRawReleases(config) {
    const { datasource, packageName, registryUrls } = config;
    const cacheKey = `${cacheNamespace}${datasource}${packageName}${String(registryUrls)}`;
    // By returning a Promise and reusing it, we should only fetch each package at most once
    const cachedResult = memCache.get(cacheKey);
    // istanbul ignore if
    if (cachedResult !== undefined) {
        return cachedResult;
    }
    const promisedRes = fetchReleases(config);
    memCache.set(cacheKey, promisedRes);
    return promisedRes;
}
async function getPkgReleases(config) {
    if (!config.datasource) {
        logger_1.logger.warn('No datasource found');
        return null;
    }
    const packageName = config.packageName || config.depName;
    if (!packageName) {
        logger_1.logger.error({ config }, 'Datasource getReleases without packageName');
        return null;
    }
    let res;
    try {
        res = (0, clone_1.clone)(await getRawReleases({
            ...config,
            packageName,
        }));
    }
    catch (e) /* istanbul ignore next */ {
        if (e instanceof external_host_error_1.ExternalHostError) {
            e.hostType = config.datasource;
            e.packageName = packageName;
        }
        throw e;
    }
    if (!res) {
        return res;
    }
    if (config.extractVersion) {
        const extractVersionRegEx = (0, regex_1.regEx)(config.extractVersion);
        res.releases = res.releases
            .map((release) => {
            const version = extractVersionRegEx.exec(release.version)?.groups
                ?.version;
            if (version) {
                return { ...release, version }; // overwrite version
            }
            return null; // filter out any we can't extract
        })
            .filter(is_1.default.truthy);
    }
    // Use the datasource's default versioning if none is configured
    const versioning = config.versioning || getDefaultVersioning(config.datasource);
    const version = allVersioning.get(versioning);
    // Filter and sort valid versions
    res.releases = res.releases
        .filter((release) => version.isVersion(release.version))
        .sort((a, b) => version.sortVersions(a.version, b.version));
    // Filter versions for uniqueness
    res.releases = res.releases.filter((filterRelease, filterIndex) => res.releases.findIndex((findRelease) => findRelease.version === filterRelease.version) === filterIndex);
    // Filter releases for compatibility
    for (const [constraintName, constraintValue] of Object.entries(config.constraints || {})) {
        // Currently we only support if the constraint is a plain version
        // TODO: Support range/range compatibility filtering #8476
        if (version.isVersion(constraintValue)) {
            res.releases = res.releases.filter((release) => {
                const constraint = release.constraints?.[constraintName];
                if (!is_1.default.nonEmptyArray(constraint)) {
                    // A release with no constraints is OK
                    return true;
                }
                return constraint.some(
                // If any of the release's constraints match, then it's OK
                (releaseConstraint) => !releaseConstraint ||
                    version.matches(constraintValue, releaseConstraint));
            });
        }
    }
    // Strip constraints from releases result
    res.releases.forEach((release) => {
        delete release.constraints;
    });
    return res;
}
exports.getPkgReleases = getPkgReleases;
function supportsDigests(datasource) {
    const ds = !!datasource && getDatasourceFor(datasource);
    return !!ds && 'getDigest' in ds;
}
exports.supportsDigests = supportsDigests;
function getDigestConfig(datasource, config) {
    const { currentValue, currentDigest } = config;
    const packageName = config.packageName ?? config.depName;
    const [registryUrl] = resolveRegistryUrls(datasource, config.defaultRegistryUrls, config.registryUrls, config.additionalRegistryUrls);
    return { packageName, registryUrl, currentValue, currentDigest };
}
function getDigest(config, value) {
    const datasource = getDatasourceFor(config.datasource);
    // istanbul ignore if: need test
    if (!datasource || !('getDigest' in datasource)) {
        return Promise.resolve(null);
    }
    const digestConfig = getDigestConfig(datasource, config);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    return datasource.getDigest(digestConfig, value);
}
exports.getDigest = getDigest;
function getDefaultConfig(datasource) {
    const loadedDatasource = getDatasourceFor(datasource);
    return Promise.resolve(loadedDatasource?.defaultConfig || Object.create({}));
}
exports.getDefaultConfig = getDefaultConfig;
//# sourceMappingURL=index.js.map