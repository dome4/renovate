"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getChangeLogJSON = void 0;
const tslib_1 = require("tslib");
const url_1 = tslib_1.__importDefault(require("url"));
const logger_1 = require("../../../../../logger");
const allVersioning = tslib_1.__importStar(require("../../../../../modules/versioning"));
const memCache = tslib_1.__importStar(require("../../../../../util/cache/memory"));
const packageCache = tslib_1.__importStar(require("../../../../../util/cache/package"));
const regex_1 = require("../../../../../util/regex");
const gitlab_1 = require("./gitlab");
const release_notes_1 = require("./release-notes");
const releases_1 = require("./releases");
const cacheNamespace = 'changelog-gitlab-release';
function getCachedTags(endpoint, versionScheme, repository) {
    const cacheKey = `getTags-${endpoint}-${versionScheme}-${repository}`;
    const cachedResult = memCache.get(cacheKey);
    // istanbul ignore if
    if (cachedResult !== undefined) {
        return cachedResult;
    }
    const promisedRes = (0, gitlab_1.getTags)(endpoint, repository);
    memCache.set(cacheKey, promisedRes);
    return promisedRes;
}
async function getChangeLogJSON(config) {
    const { versioning, currentVersion, newVersion, sourceUrl, depName, manager, sourceDirectory, } = config;
    logger_1.logger.trace('getChangeLogJSON for gitlab');
    const version = allVersioning.get(versioning);
    const { protocol, host, pathname } = url_1.default.parse(sourceUrl);
    logger_1.logger.trace({ protocol, host, pathname }, 'Protocol, host, pathname');
    const baseUrl = protocol.concat('//', host, '/');
    const apiBaseUrl = baseUrl.concat('api/v4/');
    const repository = pathname
        .slice(1)
        .replace((0, regex_1.regEx)(/\/$/), '')
        .replace((0, regex_1.regEx)(/\.git$/), '');
    if (repository.split('/').length < 2) {
        logger_1.logger.info({ sourceUrl }, 'Invalid gitlab URL found');
        return null;
    }
    const releases = config.releases || (await (0, releases_1.getInRangeReleases)(config));
    if (!releases?.length) {
        logger_1.logger.debug('No releases');
        return null;
    }
    // This extra filter/sort should not be necessary, but better safe than sorry
    const validReleases = [...releases]
        .filter((release) => version.isVersion(release.version))
        .sort((a, b) => version.sortVersions(a.version, b.version));
    if (validReleases.length < 2) {
        logger_1.logger.debug('Not enough valid releases');
        return null;
    }
    let tags;
    async function getRef(release) {
        if (!tags) {
            tags = await getCachedTags(apiBaseUrl, versioning, repository);
        }
        const regex = (0, regex_1.regEx)(`(?:${depName}|release)[@-]`, undefined, false);
        const tagName = tags
            .filter((tag) => version.isVersion(tag.replace(regex, '')))
            .find((tag) => version.equals(tag.replace(regex, ''), release.version));
        if (tagName) {
            return tagName;
        }
        if (release.gitRef) {
            return release.gitRef;
        }
        return null;
    }
    function getCacheKey(prev, next) {
        return `${manager}:${depName}:${prev}:${next}`;
    }
    const changelogReleases = [];
    // compare versions
    const include = (v) => version.isGreaterThan(v, currentVersion) &&
        !version.isGreaterThan(v, newVersion);
    for (let i = 1; i < validReleases.length; i += 1) {
        const prev = validReleases[i - 1];
        const next = validReleases[i];
        if (include(next.version)) {
            let release = await packageCache.get(cacheNamespace, getCacheKey(prev.version, next.version));
            if (!release) {
                release = {
                    version: next.version,
                    date: next.releaseTimestamp,
                    gitRef: next.gitRef,
                    // put empty changes so that existing templates won't break
                    changes: [],
                    compare: {},
                };
                const prevHead = await getRef(prev);
                const nextHead = await getRef(next);
                if (prevHead && nextHead) {
                    release.compare.url = `${baseUrl}${repository}/compare/${prevHead}...${nextHead}`;
                }
                const cacheMinutes = 55;
                await packageCache.set(cacheNamespace, getCacheKey(prev.version, next.version), release, cacheMinutes);
            }
            changelogReleases.unshift(release);
        }
    }
    let res = {
        project: {
            apiBaseUrl,
            baseUrl,
            type: 'gitlab',
            repository,
            sourceUrl,
            depName,
            sourceDirectory,
        },
        versions: changelogReleases,
    };
    res = await (0, release_notes_1.addReleaseNotes)(res, config);
    return res;
}
exports.getChangeLogJSON = getChangeLogJSON;
//# sourceMappingURL=source-gitlab.js.map