"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addMetaData = exports.normalizeDate = exports.massageGithubUrl = void 0;
const tslib_1 = require("tslib");
const url_1 = tslib_1.__importDefault(require("url"));
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const github_url_from_git_1 = tslib_1.__importDefault(require("github-url-from-git"));
const luxon_1 = require("luxon");
const hostRules = tslib_1.__importStar(require("../../util/host-rules"));
const regex_1 = require("../../util/regex");
const url_2 = require("../../util/url");
const metadata_manual_1 = require("./metadata-manual");
const githubPages = (0, regex_1.regEx)('^https://([^.]+).github.com/([^/]+)$');
const gitPrefix = (0, regex_1.regEx)('^git:/?/?');
function massageGithubUrl(url) {
    let massagedUrl = url;
    if (url.startsWith('git@')) {
        massagedUrl = url.replace(':', '/').replace('git@', 'https://');
    }
    return massagedUrl
        .replace('http:', 'https:')
        .replace('http+git:', 'https:')
        .replace('https+git:', 'https:')
        .replace('ssh://git@', 'https://')
        .replace(gitPrefix, 'https://')
        .replace(githubPages, 'https://github.com/$1/$2')
        .replace('www.github.com', 'github.com')
        .split('/')
        .slice(0, 5)
        .join('/');
}
exports.massageGithubUrl = massageGithubUrl;
function massageGitlabUrl(url) {
    return url
        .replace('http:', 'https:')
        .replace((0, regex_1.regEx)(/^git:\/?\/?/), 'https://')
        .replace((0, regex_1.regEx)(/\/tree\/.*$/i), '')
        .replace((0, regex_1.regEx)(/\/$/i), '')
        .replace('.git', '');
}
function normalizeDate(input) {
    if (typeof input === 'number' &&
        !Number.isNaN(input) &&
        input > 0 &&
        input <= Date.now() + 24 * 60 * 60 * 1000) {
        return new Date(input).toISOString();
    }
    if (typeof input === 'string') {
        // `Date.parse()` is more permissive, but it assumes local time zone
        // for inputs like `2021-01-01`.
        //
        // Here we try to parse with default UTC with fallback to `Date.parse()`.
        //
        // It allows us not to care about machine timezones so much, though
        // some misinterpretation is still possible, but only if both:
        //
        //   1. Renovate machine is configured for non-UTC zone
        //   2. Format of `input` is very exotic
        //      (from `DateTime.fromISO()` perspective)
        //
        const luxonDate = luxon_1.DateTime.fromISO(input, { zone: 'UTC' });
        if (luxonDate.isValid) {
            return luxonDate.toISO();
        }
        return normalizeDate(Date.parse(input));
    }
    if (input instanceof Date) {
        return input.toISOString();
    }
    return null;
}
exports.normalizeDate = normalizeDate;
function massageTimestamps(dep) {
    for (const release of dep.releases || []) {
        let { releaseTimestamp } = release;
        delete release.releaseTimestamp;
        releaseTimestamp = normalizeDate(releaseTimestamp);
        if (releaseTimestamp) {
            release.releaseTimestamp = releaseTimestamp;
        }
    }
}
function addMetaData(dep, datasource, packageName) {
    massageTimestamps(dep);
    const packageNameLowercase = packageName.toLowerCase();
    const manualChangelogUrl = metadata_manual_1.manualChangelogUrls[datasource]?.[packageNameLowercase];
    if (manualChangelogUrl) {
        dep.changelogUrl = manualChangelogUrl;
    }
    const manualSourceUrl = metadata_manual_1.manualSourceUrls[datasource]?.[packageNameLowercase];
    if (manualSourceUrl) {
        dep.sourceUrl = manualSourceUrl;
    }
    if (dep.changelogUrl?.includes('github.com') && // lgtm [js/incomplete-url-substring-sanitization]
        !dep.sourceUrl) {
        dep.sourceUrl = dep.changelogUrl;
    }
    // prettier-ignore
    if (dep.homepage?.includes('github.com')) { // lgtm [js/incomplete-url-substring-sanitization]
        if (!dep.sourceUrl) {
            dep.sourceUrl = dep.homepage;
        }
        delete dep.homepage;
    }
    const extraBaseUrls = [];
    // istanbul ignore next
    hostRules.hosts({ hostType: 'github' }).forEach((host) => {
        extraBaseUrls.push(host, `gist.${host}`);
    });
    extraBaseUrls.push('gitlab.com');
    if (dep.sourceUrl) {
        const parsedUrl = url_1.default.parse(dep.sourceUrl);
        if (parsedUrl?.hostname) {
            let massagedUrl;
            if (parsedUrl.hostname.includes('gitlab')) {
                massagedUrl = massageGitlabUrl(dep.sourceUrl);
            }
            else {
                massagedUrl = massageGithubUrl(dep.sourceUrl);
            }
            // try massaging it
            dep.sourceUrl =
                (0, github_url_from_git_1.default)(massagedUrl, {
                    extraBaseUrls,
                }) || dep.sourceUrl;
        }
        else {
            delete dep.sourceUrl;
        }
    }
    // Clean up any empty urls
    const urlKeys = [
        'homepage',
        'sourceUrl',
        'changelogUrl',
        'dependencyUrl',
    ];
    for (const urlKey of urlKeys) {
        const urlVal = dep[urlKey];
        if (is_1.default.string(urlVal) && (0, url_2.validateUrl)(urlVal.trim())) {
            dep[urlKey] = urlVal.trim();
        }
        else {
            delete dep[urlKey];
        }
    }
}
exports.addMetaData = addMetaData;
//# sourceMappingURL=metadata.js.map