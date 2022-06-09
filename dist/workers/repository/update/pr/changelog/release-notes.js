"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addReleaseNotes = exports.releaseNotesCacheMinutes = exports.getReleaseNotesMd = exports.getReleaseNotesMdFile = exports.getReleaseNotesMdFileInner = exports.getReleaseNotes = exports.massageBody = exports.getCachedReleaseList = exports.getReleaseList = void 0;
const tslib_1 = require("tslib");
const url_1 = tslib_1.__importDefault(require("url"));
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const luxon_1 = require("luxon");
const markdown_it_1 = tslib_1.__importDefault(require("markdown-it"));
const logger_1 = require("../../../../../logger");
const memCache = tslib_1.__importStar(require("../../../../../util/cache/memory"));
const packageCache = tslib_1.__importStar(require("../../../../../util/cache/package"));
const markdown_1 = require("../../../../../util/markdown");
const regex_1 = require("../../../../../util/regex");
const github = tslib_1.__importStar(require("./github"));
const gitlab = tslib_1.__importStar(require("./gitlab"));
const markdown = new markdown_it_1.default('zero');
markdown.enable(['heading', 'lheading']);
async function getReleaseList(project) {
    logger_1.logger.trace('getReleaseList()');
    const { apiBaseUrl, repository, type } = project;
    try {
        switch (type) {
            case 'gitlab':
                return await gitlab.getReleaseList(apiBaseUrl, repository);
            case 'github':
                return await github.getReleaseList(apiBaseUrl, repository);
            default:
                logger_1.logger.warn({ apiBaseUrl, repository, type }, 'Invalid project type');
                return [];
        }
    }
    catch (err) /* istanbul ignore next */ {
        if (err.statusCode === 404) {
            logger_1.logger.debug({ repository, type, apiBaseUrl }, 'getReleaseList 404');
        }
        else {
            logger_1.logger.debug({ repository, type, apiBaseUrl, err }, 'getReleaseList error');
        }
    }
    return [];
}
exports.getReleaseList = getReleaseList;
function getCachedReleaseList(project) {
    const cacheKey = `getReleaseList-${project.apiBaseUrl}-${project.repository}`;
    const cachedResult = memCache.get(cacheKey);
    // istanbul ignore if
    if (cachedResult !== undefined) {
        return cachedResult;
    }
    const promisedRes = getReleaseList(project);
    memCache.set(cacheKey, promisedRes);
    return promisedRes;
}
exports.getCachedReleaseList = getCachedReleaseList;
function massageBody(input, baseUrl) {
    let body = input || '';
    // Convert line returns
    body = body.replace((0, regex_1.regEx)(/\r\n/g), '\n');
    // semantic-release cleanup
    body = body.replace((0, regex_1.regEx)(/^<a name="[^"]*"><\/a>\n/), '');
    body = body.replace((0, regex_1.regEx)(`^##? \\[[^\\]]*\\]\\(${baseUrl}[^/]*\\/[^/]*\\/compare\\/.*?\\n`, undefined, false), '');
    // Clean-up unnecessary commits link
    body = `\n${body}\n`.replace((0, regex_1.regEx)(`\\n${baseUrl}[^/]+\\/[^/]+\\/compare\\/[^\\n]+(\\n|$)`), '\n');
    // Reduce headings size
    body = body
        .replace((0, regex_1.regEx)(/\n\s*####? /g), '\n##### ')
        .replace((0, regex_1.regEx)(/\n\s*## /g), '\n#### ')
        .replace((0, regex_1.regEx)(/\n\s*# /g), '\n### ');
    // Trim whitespace
    return body.trim();
}
exports.massageBody = massageBody;
async function getReleaseNotes(project, release, config) {
    const { depName, repository } = project;
    const { version, gitRef } = release;
    logger_1.logger.trace(`getReleaseNotes(${repository}, ${version}, ${depName})`);
    const releases = await getCachedReleaseList(project);
    logger_1.logger.trace({ releases }, 'Release list from getReleaseList');
    let releaseNotes = null;
    let matchedRelease = getExactReleaseMatch(depName, version, releases);
    if (is_1.default.undefined(matchedRelease)) {
        // no exact match of a release then check other cases
        matchedRelease = releases.find((r) => r.tag === version ||
            r.tag === `v${version}` ||
            r.tag === gitRef ||
            r.tag === `v${gitRef}`);
    }
    if (is_1.default.undefined(matchedRelease) && config.extractVersion) {
        const extractVersionRegEx = (0, regex_1.regEx)(config.extractVersion);
        matchedRelease = releases.find((r) => {
            const extractedVersion = extractVersionRegEx.exec(r.tag)?.groups?.version;
            return version === extractedVersion;
        });
    }
    releaseNotes = await releaseNotesResult(matchedRelease, project);
    logger_1.logger.trace({ releaseNotes });
    return releaseNotes;
}
exports.getReleaseNotes = getReleaseNotes;
function getExactReleaseMatch(depName, version, releases) {
    const exactReleaseReg = (0, regex_1.regEx)(`${depName}[@_-]v?${version}`);
    const candidateReleases = releases.filter((r) => r.tag?.endsWith(version));
    const matchedRelease = candidateReleases.find((r) => exactReleaseReg.test(r.tag));
    return matchedRelease;
}
async function releaseNotesResult(releaseMatch, project) {
    if (!releaseMatch) {
        return null;
    }
    const { baseUrl, repository } = project;
    const releaseNotes = releaseMatch;
    if (releaseMatch.url && !baseUrl.includes('gitlab')) {
        // there is a ready link
        releaseNotes.url = releaseMatch.url;
    }
    else {
        releaseNotes.url = baseUrl.includes('gitlab')
            ? `${baseUrl}${repository}/tags/${releaseMatch.tag}`
            : `${baseUrl}${repository}/releases/${releaseMatch.tag}`;
    }
    // set body for release notes
    releaseNotes.body = massageBody(releaseNotes.body, baseUrl);
    if (releaseNotes.body.length) {
        try {
            if (baseUrl !== 'https://gitlab.com/') {
                releaseNotes.body = await (0, markdown_1.linkify)(releaseNotes.body, {
                    repository: `${baseUrl}${repository}`,
                });
            }
        }
        catch (err) /* istanbul ignore next */ {
            logger_1.logger.warn({ err, baseUrl, repository }, 'Error linkifying');
        }
    }
    else {
        return null;
    }
    return releaseNotes;
}
function sectionize(text, level) {
    const sections = [];
    const lines = text.split(regex_1.newlineRegex);
    const tokens = markdown.parse(text, undefined);
    tokens.forEach((token) => {
        if (token.type === 'heading_open') {
            const lev = +token.tag.substr(1);
            if (lev <= level) {
                sections.push([lev, token.map[0]]);
            }
        }
    });
    sections.push([-1, lines.length]);
    const result = [];
    for (let i = 1; i < sections.length; i += 1) {
        const [lev, start] = sections[i - 1];
        const [, end] = sections[i];
        if (lev === level) {
            result.push(lines.slice(start, end).join('\n'));
        }
    }
    return result;
}
function isUrl(url) {
    try {
        return !!url_1.default.parse(url).hostname;
    }
    catch (err) {
        // istanbul ignore next
        logger_1.logger.debug({ err }, `Error parsing ${url} in URL.parse`);
    }
    // istanbul ignore next
    return false;
}
async function getReleaseNotesMdFileInner(project) {
    const { apiBaseUrl, repository, sourceDirectory, type } = project;
    try {
        switch (type) {
            case 'gitlab':
                return await gitlab.getReleaseNotesMd(repository, apiBaseUrl, sourceDirectory);
            case 'github':
                return await github.getReleaseNotesMd(repository, apiBaseUrl, sourceDirectory);
            default:
                logger_1.logger.warn({ apiBaseUrl, repository, type }, 'Invalid project type');
                return null;
        }
    }
    catch (err) /* istanbul ignore next */ {
        if (err.statusCode === 404) {
            logger_1.logger.debug({ repository, type, apiBaseUrl }, 'Error 404 getting changelog md');
        }
        else {
            logger_1.logger.debug({ err, repository, type, apiBaseUrl }, 'Error getting changelog md');
        }
    }
    return null;
}
exports.getReleaseNotesMdFileInner = getReleaseNotesMdFileInner;
function getReleaseNotesMdFile(project) {
    const cacheKey = `getReleaseNotesMdFile@v2-${project.repository}${project.sourceDirectory ? `-${project.sourceDirectory}` : ''}-${project.apiBaseUrl}`;
    const cachedResult = memCache.get(cacheKey);
    // istanbul ignore if
    if (cachedResult !== undefined) {
        return cachedResult;
    }
    const promisedRes = getReleaseNotesMdFileInner(project);
    memCache.set(cacheKey, promisedRes);
    return promisedRes;
}
exports.getReleaseNotesMdFile = getReleaseNotesMdFile;
async function getReleaseNotesMd(project, release) {
    const { baseUrl, repository } = project;
    const version = release.version;
    logger_1.logger.trace(`getReleaseNotesMd(${repository}, ${version})`);
    const skippedRepos = ['facebook/react-native'];
    // istanbul ignore if
    if (skippedRepos.includes(repository)) {
        return null;
    }
    const changelog = await getReleaseNotesMdFile(project);
    if (!changelog) {
        return null;
    }
    const { changelogFile } = changelog;
    const changelogMd = changelog.changelogMd.replace((0, regex_1.regEx)(/\n\s*<a name="[^"]*">.*?<\/a>\n/g), '\n');
    for (const level of [1, 2, 3, 4, 5, 6, 7]) {
        const changelogParsed = sectionize(changelogMd, level);
        if (changelogParsed.length >= 2) {
            for (const section of changelogParsed) {
                try {
                    // replace brackets and parenthesis with space
                    const deParenthesizedSection = section.replace((0, regex_1.regEx)(/[[\]()]/g), ' ');
                    const [heading] = deParenthesizedSection.split(regex_1.newlineRegex);
                    const title = heading
                        .replace((0, regex_1.regEx)(/^\s*#*\s*/), '')
                        .split(' ')
                        .filter(Boolean);
                    let body = section.replace((0, regex_1.regEx)(/.*?\n(-{3,}\n)?/), '').trim();
                    for (const word of title) {
                        if (word.includes(version) && !isUrl(word)) {
                            logger_1.logger.trace({ body }, 'Found release notes for v' + version);
                            // TODO: fix url
                            const notesSourceUrl = `${baseUrl}${repository}/blob/HEAD/${changelogFile}`;
                            const url = notesSourceUrl +
                                '#' +
                                title.join('-').replace((0, regex_1.regEx)(/[^A-Za-z0-9-]/g), '');
                            body = massageBody(body, baseUrl);
                            if (body?.length) {
                                try {
                                    body = await (0, markdown_1.linkify)(body, {
                                        repository: `${baseUrl}${repository}`,
                                    });
                                }
                                catch (err) /* istanbul ignore next */ {
                                    logger_1.logger.warn({ body, err }, 'linkify error');
                                }
                            }
                            return {
                                body,
                                url,
                                notesSourceUrl,
                            };
                        }
                    }
                }
                catch (err) /* istanbul ignore next */ {
                    logger_1.logger.warn({ err }, `Error parsing ${changelogFile}`);
                }
            }
        }
        logger_1.logger.trace({ repository }, `No level ${level} changelogs headings found`);
    }
    logger_1.logger.trace({ repository, version }, `No entry found in ${changelogFile}`);
    return null;
}
exports.getReleaseNotesMd = getReleaseNotesMd;
/**
 * Determine how long to cache release notes based on when the version was released.
 *
 * It's not uncommon for release notes to be updated shortly after the release itself,
 * so only cache for about an hour when the release is less than a week old. Otherwise,
 * cache for days.
 */
function releaseNotesCacheMinutes(releaseDate) {
    const dt = is_1.default.date(releaseDate)
        ? luxon_1.DateTime.fromJSDate(releaseDate)
        : luxon_1.DateTime.fromISO(releaseDate);
    const now = luxon_1.DateTime.local();
    if (!dt.isValid || now.diff(dt, 'days').days < 7) {
        return 55;
    }
    if (now.diff(dt, 'months').months < 6) {
        return 1435; // 5 minutes shy of one day
    }
    return 14495; // 5 minutes shy of 10 days
}
exports.releaseNotesCacheMinutes = releaseNotesCacheMinutes;
async function addReleaseNotes(input, config) {
    if (!input?.versions || !input.project?.type) {
        logger_1.logger.debug('Missing project or versions');
        return input;
    }
    const output = { ...input, versions: [] };
    const { repository, sourceDirectory } = input.project;
    const cacheNamespace = `changelog-${input.project.type}-notes@v2`;
    function getCacheKey(version) {
        return `${repository}:${sourceDirectory ? `${sourceDirectory}:` : ''}${version}`;
    }
    for (const v of input.versions) {
        let releaseNotes;
        const cacheKey = getCacheKey(v.version);
        releaseNotes = await packageCache.get(cacheNamespace, cacheKey);
        // istanbul ignore else: no cache tests
        if (!releaseNotes) {
            releaseNotes = await getReleaseNotesMd(input.project, v);
            // istanbul ignore else: should be tested
            if (!releaseNotes) {
                releaseNotes = await getReleaseNotes(input.project, v, config);
            }
            // Small hack to force display of release notes when there is a compare url
            if (!releaseNotes && v.compare.url) {
                releaseNotes = { url: v.compare.url, notesSourceUrl: '' };
            }
            const cacheMinutes = releaseNotesCacheMinutes(v.date);
            await packageCache.set(cacheNamespace, cacheKey, releaseNotes, cacheMinutes);
        }
        output.versions.push({
            ...v,
            releaseNotes,
        });
        output.hasReleaseNotes = output.hasReleaseNotes || !!releaseNotes;
    }
    return output;
}
exports.addReleaseNotes = addReleaseNotes;
//# sourceMappingURL=release-notes.js.map