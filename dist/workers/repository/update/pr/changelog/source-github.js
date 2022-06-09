"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getChangeLogJSON = void 0;
const tslib_1 = require("tslib");
const url_1 = tslib_1.__importDefault(require("url"));
const global_1 = require("../../../../../config/global");
const constants_1 = require("../../../../../constants");
const logger_1 = require("../../../../../logger");
const allVersioning = tslib_1.__importStar(require("../../../../../modules/versioning"));
const memCache = tslib_1.__importStar(require("../../../../../util/cache/memory"));
const packageCache = tslib_1.__importStar(require("../../../../../util/cache/package"));
const hostRules = tslib_1.__importStar(require("../../../../../util/host-rules"));
const regex_1 = require("../../../../../util/regex");
const github_1 = require("./github");
const release_notes_1 = require("./release-notes");
const releases_1 = require("./releases");
const types_1 = require("./types");
function getCachedTags(endpoint, repository) {
    const cacheKey = `getTags-${endpoint}-${repository}`;
    const cachedResult = memCache.get(cacheKey);
    // istanbul ignore if
    if (cachedResult !== undefined) {
        return cachedResult;
    }
    const promisedRes = (0, github_1.getTags)(endpoint, repository);
    memCache.set(cacheKey, promisedRes);
    return promisedRes;
}
async function getChangeLogJSON(config) {
    const { versioning, currentVersion, newVersion, sourceUrl, sourceDirectory, depName, manager, } = config;
    if (sourceUrl === 'https://github.com/DefinitelyTyped/DefinitelyTyped') {
        logger_1.logger.trace('No release notes for @types');
        return null;
    }
    const version = allVersioning.get(versioning);
    const { protocol, host, pathname } = url_1.default.parse(sourceUrl);
    const baseUrl = `${protocol}//${host}/`;
    const url = sourceUrl.startsWith('https://github.com/')
        ? 'https://api.github.com/'
        : sourceUrl;
    const { token } = hostRules.find({
        hostType: constants_1.PlatformId.Github,
        url,
    });
    // istanbul ignore if
    if (!token) {
        if (host.endsWith('github.com')) {
            if (!global_1.GlobalConfig.get().githubTokenWarn) {
                logger_1.logger.debug({ manager, depName, sourceUrl }, 'GitHub token warning has been suppressed. Skipping release notes retrieval');
                return null;
            }
            logger_1.logger.warn({ manager, depName, sourceUrl }, 'No github.com token has been configured. Skipping release notes retrieval');
            return { error: types_1.ChangeLogError.MissingGithubToken };
        }
        logger_1.logger.debug({ manager, depName, sourceUrl }, 'Repository URL does not match any known github hosts - skipping changelog retrieval');
        return null;
    }
    const apiBaseUrl = sourceUrl.startsWith('https://github.com/')
        ? 'https://api.github.com/'
        : baseUrl + 'api/v3/';
    const repository = pathname
        .slice(1)
        .replace((0, regex_1.regEx)(/\/$/), '')
        .replace((0, regex_1.regEx)(/\.git$/), '');
    if (repository.split('/').length !== 2) {
        logger_1.logger.debug({ sourceUrl }, 'Invalid github URL found');
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
        logger_1.logger.debug(`Not enough valid releases for dep ${depName}`);
        return null;
    }
    let tags;
    async function getRef(release) {
        if (!tags) {
            tags = await getCachedTags(apiBaseUrl, repository);
        }
        const tagName = findTagOfRelease(version, depName, release.version, tags);
        if (tagName) {
            return tagName;
        }
        if (release.gitRef) {
            return release.gitRef;
        }
        return null;
    }
    const cacheNamespace = 'changelog-github-release';
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
            // istanbul ignore else
            if (!release) {
                release = {
                    version: next.version,
                    gitRef: next.gitRef,
                    date: next.releaseTimestamp,
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
            type: 'github',
            repository,
            sourceUrl,
            sourceDirectory,
            depName,
        },
        versions: changelogReleases,
    };
    res = await (0, release_notes_1.addReleaseNotes)(res, config);
    return res;
}
exports.getChangeLogJSON = getChangeLogJSON;
function findTagOfRelease(version, depName, depNewVersion, tags) {
    const regex = (0, regex_1.regEx)(`(?:${depName}|release)[@-]`, undefined, false);
    const excactReleaseRegex = (0, regex_1.regEx)(`${depName}[@-_]v?${depNewVersion}`);
    const exactTagsList = tags.filter((tag) => {
        return excactReleaseRegex.test(tag);
    });
    let tagName;
    if (exactTagsList.length) {
        tagName = exactTagsList
            .filter((tag) => version.isVersion(tag.replace(regex, '')))
            .find((tag) => version.equals(tag.replace(regex, ''), depNewVersion));
    }
    else {
        tagName = tags
            .filter((tag) => version.isVersion(tag.replace(regex, '')))
            .find((tag) => version.equals(tag.replace(regex, ''), depNewVersion));
    }
    return tagName;
}
//# sourceMappingURL=source-github.js.map