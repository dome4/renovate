"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SbtPackageDatasource = void 0;
const tslib_1 = require("tslib");
const xmldoc_1 = require("xmldoc");
const logger_1 = require("../../../logger");
const http_1 = require("../../../util/http");
const regex_1 = require("../../../util/regex");
const url_1 = require("../../../util/url");
const ivyVersioning = tslib_1.__importStar(require("../../versioning/ivy"));
const compare_1 = require("../../versioning/maven/compare");
const datasource_1 = require("../datasource");
const common_1 = require("../maven/common");
const util_1 = require("../maven/util");
const util_2 = require("./util");
class SbtPackageDatasource extends datasource_1.Datasource {
    constructor(id = SbtPackageDatasource.id) {
        super(id);
        this.defaultRegistryUrls = [common_1.MAVEN_REPO];
        this.defaultVersioning = ivyVersioning.id;
        this.registryStrategy = 'hunt';
        this.http = new http_1.Http('sbt');
    }
    async getArtifactSubdirs(searchRoot, artifact, scalaVersion) {
        const pkgUrl = (0, url_1.ensureTrailingSlash)(searchRoot);
        const { body: indexContent } = await (0, util_1.downloadHttpProtocol)(this.http, pkgUrl);
        if (indexContent) {
            const parseSubdirs = (content) => (0, util_2.parseIndexDir)(content, (x) => {
                if (x === artifact) {
                    return true;
                }
                if (x.startsWith(`${artifact}_native`)) {
                    return false;
                }
                if (x.startsWith(`${artifact}_sjs`)) {
                    return false;
                }
                return x.startsWith(`${artifact}_`);
            });
            const normalizedContent = (0, util_2.normalizeRootRelativeUrls)(indexContent, pkgUrl);
            let artifactSubdirs = parseSubdirs(normalizedContent);
            if (scalaVersion &&
                artifactSubdirs.includes(`${artifact}_${scalaVersion}`)) {
                artifactSubdirs = [`${artifact}_${scalaVersion}`];
            }
            return artifactSubdirs;
        }
        return null;
    }
    async getPackageReleases(searchRoot, artifactSubdirs) {
        if (artifactSubdirs) {
            const releases = [];
            const parseReleases = (content) => (0, util_2.parseIndexDir)(content, (x) => !(0, regex_1.regEx)(/^\.+$/).test(x));
            for (const searchSubdir of artifactSubdirs) {
                const pkgUrl = (0, url_1.ensureTrailingSlash)(`${searchRoot}/${searchSubdir}`);
                const { body: content } = await (0, util_1.downloadHttpProtocol)(this.http, pkgUrl);
                if (content) {
                    const normalizedContent = (0, util_2.normalizeRootRelativeUrls)(content, pkgUrl);
                    const subdirReleases = parseReleases(normalizedContent);
                    subdirReleases.forEach((x) => releases.push(x));
                }
            }
            if (releases.length) {
                return [...new Set(releases)].sort(compare_1.compare);
            }
        }
        return null;
    }
    async getUrls(searchRoot, artifactDirs, version) {
        const result = {};
        if (!artifactDirs?.length) {
            return result;
        }
        if (!version) {
            return result;
        }
        for (const artifactDir of artifactDirs) {
            const [artifact] = artifactDir.split('_');
            const pomFileNames = [
                `${artifactDir}-${version}.pom`,
                `${artifact}-${version}.pom`,
            ];
            for (const pomFileName of pomFileNames) {
                const pomUrl = `${searchRoot}/${artifactDir}/${version}/${pomFileName}`;
                const { body: content } = await (0, util_1.downloadHttpProtocol)(this.http, pomUrl);
                if (content) {
                    const pomXml = new xmldoc_1.XmlDocument(content);
                    const homepage = pomXml.valueWithPath('url');
                    if (homepage) {
                        result.homepage = homepage;
                    }
                    const sourceUrl = pomXml.valueWithPath('scm.url');
                    if (sourceUrl) {
                        result.sourceUrl = sourceUrl
                            .replace((0, regex_1.regEx)(/^scm:/), '')
                            .replace((0, regex_1.regEx)(/^git:/), '')
                            .replace((0, regex_1.regEx)(/^git@github.com:/), 'https://github.com/')
                            .replace((0, regex_1.regEx)(/\.git$/), '');
                    }
                    return result;
                }
            }
        }
        return result;
    }
    async getReleases({ packageName, registryUrl, }) {
        // istanbul ignore if
        if (!registryUrl) {
            return null;
        }
        const [groupId, artifactId] = packageName.split(':');
        const groupIdSplit = groupId.split('.');
        const artifactIdSplit = artifactId.split('_');
        const [artifact, scalaVersion] = artifactIdSplit;
        const repoRoot = (0, url_1.ensureTrailingSlash)(registryUrl);
        const searchRoots = [];
        // Optimize lookup order
        searchRoots.push(`${repoRoot}${groupIdSplit.join('/')}`);
        searchRoots.push(`${repoRoot}${groupIdSplit.join('.')}`);
        for (let idx = 0; idx < searchRoots.length; idx += 1) {
            const searchRoot = searchRoots[idx];
            const artifactSubdirs = await this.getArtifactSubdirs(searchRoot, artifact, scalaVersion);
            const versions = await this.getPackageReleases(searchRoot, artifactSubdirs);
            const latestVersion = (0, util_2.getLatestVersion)(versions);
            const urls = await this.getUrls(searchRoot, artifactSubdirs, latestVersion);
            const dependencyUrl = searchRoot;
            if (versions) {
                return {
                    ...urls,
                    dependencyUrl,
                    releases: versions.map((v) => ({ version: v })),
                };
            }
        }
        logger_1.logger.debug(`No versions found for ${packageName} in ${searchRoots.length} repositories`);
        return null;
    }
}
exports.SbtPackageDatasource = SbtPackageDatasource;
SbtPackageDatasource.id = 'sbt-package';
//# sourceMappingURL=index.js.map