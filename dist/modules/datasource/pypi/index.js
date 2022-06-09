"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PypiDatasource = void 0;
const tslib_1 = require("tslib");
const url_1 = tslib_1.__importDefault(require("url"));
const changelog_filename_regex_1 = tslib_1.__importDefault(require("changelog-filename-regex"));
const logger_1 = require("../../../logger");
const html_1 = require("../../../util/html");
const regex_1 = require("../../../util/regex");
const url_2 = require("../../../util/url");
const pep440 = tslib_1.__importStar(require("../../versioning/pep440"));
const datasource_1 = require("../datasource");
const githubRepoPattern = (0, regex_1.regEx)(/^https?:\/\/github\.com\/[^\\/]+\/[^\\/]+$/);
class PypiDatasource extends datasource_1.Datasource {
    constructor() {
        super(PypiDatasource.id);
        this.caching = true;
        this.customRegistrySupport = true;
        this.defaultRegistryUrls = [
            process.env.PIP_INDEX_URL || 'https://pypi.org/pypi/',
        ];
        this.defaultVersioning = pep440.id;
        this.registryStrategy = 'merge';
    }
    async getReleases({ packageName, registryUrl, }) {
        let dependency = null;
        const hostUrl = (0, url_2.ensureTrailingSlash)(`${registryUrl}`);
        const normalizedLookupName = PypiDatasource.normalizeName(packageName);
        // not all simple indexes use this identifier, but most do
        if (hostUrl.endsWith('/simple/') || hostUrl.endsWith('/+simple/')) {
            logger_1.logger.trace({ packageName, hostUrl }, 'Looking up pypi simple dependency');
            dependency = await this.getSimpleDependency(normalizedLookupName, hostUrl);
        }
        else {
            logger_1.logger.trace({ packageName, hostUrl }, 'Looking up pypi api dependency');
            try {
                // we need to resolve early here so we can catch any 404s and fallback to a simple lookup
                dependency = await this.getDependency(normalizedLookupName, hostUrl);
            }
            catch (err) {
                if (err.statusCode !== 404) {
                    throw err;
                }
                // error contacting json-style api -- attempt to fallback to a simple-style api
                logger_1.logger.trace({ packageName, hostUrl }, 'Looking up pypi simple dependency via fallback');
                dependency = await this.getSimpleDependency(normalizedLookupName, hostUrl);
            }
        }
        return dependency;
    }
    static normalizeName(input) {
        return input.toLowerCase().replace((0, regex_1.regEx)(/_/g), '-');
    }
    static normalizeNameForUrlLookup(input) {
        return input.toLowerCase().replace((0, regex_1.regEx)(/(_|\.|-)+/g), '-');
    }
    async getDependency(packageName, hostUrl) {
        const lookupUrl = url_1.default.resolve(hostUrl, `${PypiDatasource.normalizeNameForUrlLookup(packageName)}/json`);
        const dependency = { releases: [] };
        logger_1.logger.trace({ lookupUrl }, 'Pypi api got lookup');
        const rep = await this.http.getJson(lookupUrl);
        const dep = rep?.body;
        if (!dep) {
            logger_1.logger.trace({ dependency: packageName }, 'pip package not found');
            return null;
        }
        if (rep.authorization) {
            dependency.isPrivate = true;
        }
        logger_1.logger.trace({ lookupUrl }, 'Got pypi api result');
        if (dep.info?.home_page) {
            dependency.homepage = dep.info.home_page;
            if (githubRepoPattern.exec(dep.info.home_page)) {
                dependency.sourceUrl = dep.info.home_page.replace('http://', 'https://');
            }
        }
        if (dep.info?.project_urls) {
            for (const [name, projectUrl] of Object.entries(dep.info.project_urls)) {
                const lower = name.toLowerCase();
                if (!dependency.sourceUrl &&
                    (lower.startsWith('repo') ||
                        lower === 'code' ||
                        lower === 'source' ||
                        githubRepoPattern.exec(projectUrl))) {
                    dependency.sourceUrl = projectUrl;
                }
                if (!dependency.changelogUrl &&
                    ([
                        'changelog',
                        'change log',
                        'changes',
                        'release notes',
                        'news',
                        "what's new",
                    ].includes(lower) ||
                        changelog_filename_regex_1.default.exec(lower))) {
                    // from https://github.com/pypa/warehouse/blob/418c7511dc367fb410c71be139545d0134ccb0df/warehouse/templates/packaging/detail.html#L24
                    dependency.changelogUrl = projectUrl;
                }
            }
        }
        if (dep.releases) {
            const versions = Object.keys(dep.releases);
            dependency.releases = versions.map((version) => {
                const releases = dep.releases?.[version] || [];
                const { upload_time: releaseTimestamp } = releases[0] || {};
                const isDeprecated = releases.some(({ yanked }) => yanked);
                const result = {
                    version,
                    releaseTimestamp,
                };
                if (isDeprecated) {
                    result.isDeprecated = isDeprecated;
                }
                // There may be multiple releases with different requires_python, so we return all in an array
                result.constraints = {
                    // TODO: string[] isn't allowed here
                    python: releases.map(({ requires_python }) => requires_python),
                };
                return result;
            });
        }
        return dependency;
    }
    static extractVersionFromLinkText(text, packageName) {
        // source packages
        const srcText = PypiDatasource.normalizeName(text);
        const srcPrefix = `${packageName}-`;
        const srcSuffix = '.tar.gz';
        if (srcText.startsWith(srcPrefix) && srcText.endsWith(srcSuffix)) {
            return srcText.replace(srcPrefix, '').replace((0, regex_1.regEx)(/\.tar\.gz$/), '');
        }
        // pep-0427 wheel packages
        //  {distribution}-{version}(-{build tag})?-{python tag}-{abi tag}-{platform tag}.whl.
        const wheelText = text.toLowerCase();
        const wheelPrefix = packageName.replace((0, regex_1.regEx)(/[^\w\d.]+/g), '_') + '-';
        const wheelSuffix = '.whl';
        if (wheelText.startsWith(wheelPrefix) &&
            wheelText.endsWith(wheelSuffix) &&
            wheelText.split('-').length > 2) {
            return wheelText.split('-')[1];
        }
        return null;
    }
    static cleanSimpleHtml(html) {
        return (html
            .replace((0, regex_1.regEx)(/<\/?pre>/), '')
            // Certain simple repositories like artifactory don't escape > and <
            .replace((0, regex_1.regEx)(/data-requires-python="([^"]*?)>([^"]*?)"/g), 'data-requires-python="$1&gt;$2"')
            .replace((0, regex_1.regEx)(/data-requires-python="([^"]*?)<([^"]*?)"/g), 'data-requires-python="$1&lt;$2"'));
    }
    async getSimpleDependency(packageName, hostUrl) {
        const lookupUrl = url_1.default.resolve(hostUrl, (0, url_2.ensureTrailingSlash)(PypiDatasource.normalizeNameForUrlLookup(packageName)));
        const dependency = { releases: [] };
        const response = await this.http.get(lookupUrl);
        const dep = response?.body;
        if (!dep) {
            logger_1.logger.trace({ dependency: packageName }, 'pip package not found');
            return null;
        }
        if (response.authorization) {
            dependency.isPrivate = true;
        }
        const root = (0, html_1.parse)(PypiDatasource.cleanSimpleHtml(dep));
        const links = root.querySelectorAll('a');
        const releases = {};
        for (const link of Array.from(links)) {
            const version = PypiDatasource.extractVersionFromLinkText(link.text, packageName);
            if (version) {
                const release = {
                    yanked: link.hasAttribute('data-yanked'),
                };
                const requiresPython = link.getAttribute('data-requires-python');
                if (requiresPython) {
                    release.requires_python = requiresPython;
                }
                if (!releases[version]) {
                    releases[version] = [];
                }
                releases[version].push(release);
            }
        }
        const versions = Object.keys(releases);
        dependency.releases = versions.map((version) => {
            const versionReleases = releases[version] || [];
            const isDeprecated = versionReleases.some(({ yanked }) => yanked);
            const result = { version };
            if (isDeprecated) {
                result.isDeprecated = isDeprecated;
            }
            // There may be multiple releases with different requires_python, so we return all in an array
            result.constraints = {
                // TODO: string[] isn't allowed here
                python: versionReleases.map(({ requires_python }) => requires_python),
            };
            return result;
        });
        return dependency;
    }
}
exports.PypiDatasource = PypiDatasource;
PypiDatasource.id = 'pypi';
//# sourceMappingURL=index.js.map