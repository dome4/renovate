"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDependency = exports.resetCache = exports.resetMemCache = void 0;
const tslib_1 = require("tslib");
const url_1 = tslib_1.__importDefault(require("url"));
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const logger_1 = require("../../../logger");
const external_host_error_1 = require("../../../types/errors/external-host-error");
const packageCache = tslib_1.__importStar(require("../../../util/cache/package"));
const url_2 = require("../../../util/url");
const common_1 = require("./common");
let memcache = {};
function resetMemCache() {
    logger_1.logger.debug('resetMemCache()');
    memcache = {};
}
exports.resetMemCache = resetMemCache;
function resetCache() {
    resetMemCache();
}
exports.resetCache = resetCache;
function getPackageSource(repository) {
    const res = {};
    if (repository) {
        if (is_1.default.nonEmptyString(repository)) {
            res.sourceUrl = repository;
        }
        else if (is_1.default.nonEmptyString(repository.url)) {
            res.sourceUrl = repository.url;
        }
        if (is_1.default.nonEmptyString(repository.directory)) {
            res.sourceDirectory = repository.directory;
        }
        const sourceUrlCopy = `${res.sourceUrl}`;
        const sourceUrlSplit = sourceUrlCopy.split('/');
        if (sourceUrlSplit.length > 7 && sourceUrlSplit[2] === 'github.com') {
            // Massage the repository URL for non-compliant strings for github (see issue #4610)
            // Remove the non-compliant segments of path, so the URL looks like "<scheme>://<domain>/<vendor>/<repo>"
            // and add directory to the repository
            res.sourceUrl = sourceUrlSplit.slice(0, 5).join('/');
            res.sourceDirectory || (res.sourceDirectory = sourceUrlSplit
                .slice(7, sourceUrlSplit.length)
                .join('/'));
        }
    }
    return res;
}
async function getDependency(http, registryUrl, packageName) {
    logger_1.logger.trace(`npm.getDependency(${packageName})`);
    // This is our datastore cache and is cleared at the end of each repo, i.e. we never requery/revalidate during a "run"
    if (memcache[packageName]) {
        logger_1.logger.trace('Returning cached result');
        return JSON.parse(memcache[packageName]);
    }
    const packageUrl = (0, url_2.joinUrlParts)(registryUrl, packageName.replace('/', '%2F'));
    // Now check the persistent cache
    const cacheNamespace = 'datasource-npm';
    const cachedResult = await packageCache.get(cacheNamespace, packageUrl);
    // istanbul ignore if
    if (cachedResult) {
        return cachedResult;
    }
    const uri = url_1.default.parse(packageUrl);
    try {
        const raw = await http.getJson(packageUrl);
        const res = raw.body;
        if (!res.versions || !Object.keys(res.versions).length) {
            // Registry returned a 200 OK but with no versions
            logger_1.logger.debug({ dependency: packageName }, 'No versions returned');
            return null;
        }
        const latestVersion = res.versions[res['dist-tags']?.latest ?? ''];
        res.repository = res.repository || latestVersion?.repository;
        res.homepage = res.homepage || latestVersion?.homepage;
        const { sourceUrl, sourceDirectory } = getPackageSource(res.repository);
        // Simplify response before caching and returning
        const dep = {
            name: res.name,
            homepage: res.homepage,
            sourceUrl,
            sourceDirectory,
            versions: {},
            releases: [],
            'dist-tags': res['dist-tags'],
            registryUrl,
        };
        if (latestVersion?.deprecated) {
            dep.deprecationMessage = `On registry \`${registryUrl}\`, the "latest" version of dependency \`${packageName}\` has the following deprecation notice:\n\n\`${latestVersion.deprecated}\`\n\nMarking the latest version of an npm package as deprecated results in the entire package being considered deprecated, so contact the package author you think this is a mistake.`;
            dep.deprecationSource = common_1.id;
        }
        dep.releases = Object.keys(res.versions).map((version) => {
            const release = {
                version,
                gitRef: res.versions?.[version].gitHead,
                dependencies: res.versions?.[version].dependencies,
                devDependencies: res.versions?.[version].devDependencies,
            };
            if (res.time?.[version]) {
                release.releaseTimestamp = res.time[version];
            }
            if (res.versions?.[version].deprecated) {
                release.isDeprecated = true;
            }
            const source = getPackageSource(res.versions?.[version].repository);
            if (source.sourceUrl && source.sourceUrl !== dep.sourceUrl) {
                release.sourceUrl = source.sourceUrl;
            }
            if (source.sourceDirectory &&
                source.sourceDirectory !== dep.sourceDirectory) {
                release.sourceDirectory = source.sourceDirectory;
            }
            return release;
        });
        logger_1.logger.trace({ dep }, 'dep');
        // serialize first before saving
        memcache[packageName] = JSON.stringify(dep);
        const cacheMinutes = process.env.RENOVATE_CACHE_NPM_MINUTES
            ? parseInt(process.env.RENOVATE_CACHE_NPM_MINUTES, 10)
            : 15;
        // TODO: use dynamic detection of public repos instead of a static list (#9587)
        const whitelistedPublicScopes = [
            '@graphql-codegen',
            '@storybook',
            '@types',
            '@typescript-eslint',
        ];
        if (!raw.authorization &&
            (whitelistedPublicScopes.includes(packageName.split('/')[0]) ||
                !packageName.startsWith('@'))) {
            await packageCache.set(cacheNamespace, packageUrl, dep, cacheMinutes);
        }
        return dep;
    }
    catch (err) {
        if (err.statusCode === 401 || err.statusCode === 403) {
            logger_1.logger.debug({
                packageUrl,
                err,
                statusCode: err.statusCode,
                packageName,
            }, `Dependency lookup failure: unauthorized`);
            return null;
        }
        if (err.statusCode === 402) {
            logger_1.logger.debug({
                packageUrl,
                err,
                statusCode: err.statusCode,
                packageName,
            }, `Dependency lookup failure: payment required`);
            return null;
        }
        if (err.statusCode === 404 || err.code === 'ENOTFOUND') {
            logger_1.logger.debug({ err, packageName }, `Dependency lookup failure: not found`);
            return null;
        }
        if (uri.host === 'registry.npmjs.org') {
            // istanbul ignore if
            if (err.name === 'ParseError' && err.body) {
                err.body = 'err.body deleted by Renovate';
            }
            throw new external_host_error_1.ExternalHostError(err);
        }
        return null;
    }
}
exports.getDependency = getDependency;
//# sourceMappingURL=get.js.map