"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReleases = exports.getResourceUrl = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const p_all_1 = tslib_1.__importDefault(require("p-all"));
const semver_1 = tslib_1.__importDefault(require("semver"));
const xmldoc_1 = require("xmldoc");
const logger_1 = require("../../../logger");
const external_host_error_1 = require("../../../types/errors/external-host-error");
const packageCache = tslib_1.__importStar(require("../../../util/cache/package"));
const http_1 = require("../../../util/http");
const regex_1 = require("../../../util/regex");
const url_1 = require("../../../util/url");
const common_1 = require("./common");
const cacheNamespace = 'datasource-nuget';
async function getResourceUrl(http, url, resourceType = 'RegistrationsBaseUrl') {
    // https://docs.microsoft.com/en-us/nuget/api/service-index
    const resultCacheKey = `${url}:${resourceType}`;
    const cachedResult = await packageCache.get(cacheNamespace, resultCacheKey);
    // istanbul ignore if
    if (cachedResult) {
        return cachedResult;
    }
    try {
        const responseCacheKey = url;
        let servicesIndexRaw = await packageCache.get(cacheNamespace, responseCacheKey);
        // istanbul ignore else: currently not testable
        if (!servicesIndexRaw) {
            servicesIndexRaw = (await http.getJson(url)).body;
            await packageCache.set(cacheNamespace, responseCacheKey, servicesIndexRaw, 3 * 24 * 60);
        }
        const services = servicesIndexRaw.resources
            .map(({ '@id': serviceId, '@type': t }) => ({
            serviceId,
            type: t?.split('/')?.shift(),
            version: t?.split('/')?.pop(),
        }))
            .filter(({ type, version }) => type === resourceType && semver_1.default.valid(version))
            .sort((x, y) => x.version && y.version ? semver_1.default.compare(x.version, y.version) : 0);
        const { serviceId, version } = services.pop();
        // istanbul ignore if
        if (resourceType === 'RegistrationsBaseUrl' &&
            version &&
            !version.startsWith('3.0.0-') &&
            !semver_1.default.satisfies(version, '^3.0.0')) {
            logger_1.logger.warn({ url, version }, `Nuget: Unknown version returned. Only v3 is supported`);
        }
        await packageCache.set(cacheNamespace, resultCacheKey, serviceId, 60);
        return serviceId;
    }
    catch (err) {
        // istanbul ignore if: not easy testable with nock
        if (err instanceof external_host_error_1.ExternalHostError) {
            throw err;
        }
        logger_1.logger.debug({ err, url }, `nuget registry failure: can't get ${resourceType}`);
        return null;
    }
}
exports.getResourceUrl = getResourceUrl;
async function getCatalogEntry(http, catalogPage) {
    let items = catalogPage.items;
    if (!items) {
        const url = catalogPage['@id'];
        const catalogPageFull = await http.getJson(url);
        items = catalogPageFull.body.items;
    }
    return items.map(({ catalogEntry }) => catalogEntry);
}
async function getReleases(http, registryUrl, feedUrl, pkgName) {
    const baseUrl = feedUrl.replace((0, regex_1.regEx)(/\/*$/), '');
    const url = `${baseUrl}/${pkgName.toLowerCase()}/index.json`;
    const packageRegistration = await http.getJson(url);
    const catalogPages = packageRegistration.body.items || [];
    const catalogPagesQueue = catalogPages.map((page) => () => getCatalogEntry(http, page));
    const catalogEntries = (await (0, p_all_1.default)(catalogPagesQueue, { concurrency: 5 })).flat();
    let homepage = null;
    let latestStable = null;
    const releases = catalogEntries.map(({ version, published: releaseTimestamp, projectUrl, listed }) => {
        const release = { version: (0, common_1.removeBuildMeta)(version) };
        if (releaseTimestamp) {
            release.releaseTimestamp = releaseTimestamp;
        }
        if (semver_1.default.valid(version) && !semver_1.default.prerelease(version)) {
            latestStable = (0, common_1.removeBuildMeta)(version);
            homepage = projectUrl ? (0, common_1.massageUrl)(projectUrl) : homepage;
        }
        if (listed === false) {
            release.isDeprecated = true;
        }
        return release;
    });
    if (!releases.length) {
        return null;
    }
    // istanbul ignore if: only happens when no stable version exists
    if (latestStable === null && catalogPages.length) {
        const last = catalogEntries.pop();
        latestStable = (0, common_1.removeBuildMeta)(last.version);
        homepage ?? (homepage = last.projectUrl ?? null);
    }
    const dep = {
        releases,
    };
    try {
        const packageBaseAddress = await getResourceUrl(http, registryUrl, 'PackageBaseAddress');
        // istanbul ignore else: this is a required v3 api
        if (is_1.default.nonEmptyString(packageBaseAddress)) {
            const nuspecUrl = `${(0, url_1.ensureTrailingSlash)(packageBaseAddress)}${pkgName.toLowerCase()}/${latestStable}/${pkgName.toLowerCase()}.nuspec`;
            const metaresult = await http.get(nuspecUrl);
            const nuspec = new xmldoc_1.XmlDocument(metaresult.body);
            const sourceUrl = nuspec.valueWithPath('metadata.repository@url');
            if (sourceUrl) {
                dep.sourceUrl = (0, common_1.massageUrl)(sourceUrl);
            }
        }
    }
    catch (err) {
        // istanbul ignore if: not easy testable with nock
        if (err instanceof external_host_error_1.ExternalHostError) {
            throw err;
        }
        // ignore / silence 404. Seen on proget, if remote connector is used and package is not yet cached
        if (err instanceof http_1.HttpError && err.response?.statusCode === 404) {
            logger_1.logger.debug({ registryUrl, pkgName, pkgVersion: latestStable }, `package manifest (.nuspec) not found`);
            return dep;
        }
        logger_1.logger.debug({ err, registryUrl, pkgName, pkgVersion: latestStable }, `Cannot obtain sourceUrl`);
        return dep;
    }
    // istanbul ignore else: not easy testable
    if (homepage) {
        // only assign if not assigned
        dep.sourceUrl ?? (dep.sourceUrl = homepage);
        dep.homepage ?? (dep.homepage = homepage);
    }
    return dep;
}
exports.getReleases = getReleases;
//# sourceMappingURL=v3.js.map