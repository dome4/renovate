"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDependencyInfo = exports.createUrlForDependencyPom = exports.getDependencyParts = exports.downloadMavenXml = exports.getMavenUrl = exports.checkResource = exports.checkS3Resource = exports.downloadS3Protocol = exports.downloadHttpProtocol = void 0;
const buffer_1 = require("buffer");
const stream_1 = require("stream");
const luxon_1 = require("luxon");
const xmldoc_1 = require("xmldoc");
const error_messages_1 = require("../../../constants/error-messages");
const logger_1 = require("../../../logger");
const external_host_error_1 = require("../../../types/errors/external-host-error");
const regex_1 = require("../../../util/regex");
const s3_1 = require("../../../util/s3");
const streams_1 = require("../../../util/streams");
const url_1 = require("../../../util/url");
const metadata_1 = require("../metadata");
const common_1 = require("./common");
function getHost(url) {
    return (0, url_1.parseUrl)(url)?.host ?? null;
}
function isMavenCentral(pkgUrl) {
    const host = typeof pkgUrl === 'string' ? pkgUrl : pkgUrl.host;
    return getHost(common_1.MAVEN_REPO) === host;
}
function isTemporalError(err) {
    return (err.code === 'ECONNRESET' ||
        err.statusCode === 429 ||
        (err.statusCode >= 500 && err.statusCode < 600));
}
function isHostError(err) {
    return err.code === 'ETIMEDOUT';
}
function isNotFoundError(err) {
    return err.code === 'ENOTFOUND' || err.statusCode === 404;
}
function isPermissionsIssue(err) {
    return err.statusCode === 401 || err.statusCode === 403;
}
function isConnectionError(err) {
    return (err.code === 'EAI_AGAIN' ||
        err.code === 'ERR_TLS_CERT_ALTNAME_INVALID' ||
        err.code === 'ECONNREFUSED');
}
function isUnsupportedHostError(err) {
    return err.name === 'UnsupportedProtocolError';
}
async function downloadHttpProtocol(http, pkgUrl) {
    let raw;
    try {
        raw = await http.get(pkgUrl.toString());
        return raw;
    }
    catch (err) {
        const failedUrl = pkgUrl.toString();
        if (err.message === error_messages_1.HOST_DISABLED) {
            // istanbul ignore next
            logger_1.logger.trace({ failedUrl }, 'Host disabled');
        }
        else if (isNotFoundError(err)) {
            logger_1.logger.trace({ failedUrl }, `Url not found`);
        }
        else if (isHostError(err)) {
            // istanbul ignore next
            logger_1.logger.debug({ failedUrl }, `Cannot connect to host`);
        }
        else if (isPermissionsIssue(err)) {
            logger_1.logger.debug({ failedUrl }, 'Dependency lookup unauthorized. Please add authentication with a hostRule');
        }
        else if (isTemporalError(err)) {
            logger_1.logger.debug({ failedUrl, err }, 'Temporary error');
            if (isMavenCentral(pkgUrl)) {
                throw new external_host_error_1.ExternalHostError(err);
            }
        }
        else if (isConnectionError(err)) {
            // istanbul ignore next
            logger_1.logger.debug({ failedUrl }, 'Connection refused to maven registry');
        }
        else if (isUnsupportedHostError(err)) {
            // istanbul ignore next
            logger_1.logger.debug({ failedUrl }, 'Unsupported host');
        }
        else {
            logger_1.logger.info({ failedUrl, err }, 'Unknown HTTP download error');
        }
        return {};
    }
}
exports.downloadHttpProtocol = downloadHttpProtocol;
function isS3NotFound(err) {
    return err.message === 'NotFound' || err.message === 'NoSuchKey';
}
async function downloadS3Protocol(pkgUrl) {
    logger_1.logger.trace({ url: pkgUrl.toString() }, `Attempting to load S3 dependency`);
    try {
        const s3Url = (0, s3_1.parseS3Url)(pkgUrl);
        if (s3Url === null) {
            return null;
        }
        const { Body: res } = await (0, s3_1.getS3Client)().getObject(s3Url);
        // istanbul ignore if
        if (res instanceof buffer_1.Blob) {
            return res.toString();
        }
        if (res instanceof stream_1.Readable) {
            return (0, streams_1.streamToString)(res);
        }
    }
    catch (err) {
        const failedUrl = pkgUrl.toString();
        if (err.name === 'CredentialsProviderError') {
            logger_1.logger.debug({ failedUrl }, 'Dependency lookup authorization failed. Please correct AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY env vars');
        }
        else if (err.message === 'Region is missing') {
            logger_1.logger.debug({ failedUrl }, 'Dependency lookup failed. Please a correct AWS_REGION env var');
        }
        else if (isS3NotFound(err)) {
            logger_1.logger.trace({ failedUrl }, `S3 url not found`);
        }
        else {
            logger_1.logger.debug({ failedUrl, message: err.message }, 'Unknown S3 download error');
        }
    }
    return null;
}
exports.downloadS3Protocol = downloadS3Protocol;
async function checkHttpResource(http, pkgUrl) {
    try {
        const res = await http.head(pkgUrl.toString());
        const timestamp = res?.headers?.['last-modified'];
        if (timestamp) {
            const isoTimestamp = (0, metadata_1.normalizeDate)(timestamp);
            if (isoTimestamp) {
                const releaseDate = luxon_1.DateTime.fromISO(isoTimestamp, {
                    zone: 'UTC',
                }).toJSDate();
                return releaseDate;
            }
        }
        return 'found';
    }
    catch (err) {
        if (isNotFoundError(err)) {
            return 'not-found';
        }
        const failedUrl = pkgUrl.toString();
        logger_1.logger.debug({ failedUrl, statusCode: err.statusCode }, `Can't check HTTP resource existence`);
        return 'error';
    }
}
async function checkS3Resource(pkgUrl) {
    try {
        const s3Url = (0, s3_1.parseS3Url)(pkgUrl);
        if (s3Url === null) {
            return 'error';
        }
        const response = await (0, s3_1.getS3Client)().headObject(s3Url);
        if (response.DeleteMarker) {
            return 'not-found';
        }
        if (response.LastModified) {
            return response.LastModified;
        }
        return 'found';
    }
    catch (err) {
        if (isS3NotFound(err)) {
            return 'not-found';
        }
        else {
            logger_1.logger.debug({ pkgUrl, name: err.name, message: err.message }, `Can't check S3 resource existence`);
        }
        return 'error';
    }
}
exports.checkS3Resource = checkS3Resource;
async function checkResource(http, pkgUrl) {
    const parsedUrl = typeof pkgUrl === 'string' ? (0, url_1.parseUrl)(pkgUrl) : pkgUrl;
    if (parsedUrl === null) {
        return 'error';
    }
    switch (parsedUrl.protocol) {
        case 'http:':
        case 'https:':
            return await checkHttpResource(http, parsedUrl);
        case 's3:':
            return await checkS3Resource(parsedUrl);
        default:
            logger_1.logger.debug({ url: pkgUrl.toString() }, `Unsupported Maven protocol in check resource`);
            return 'not-found';
    }
}
exports.checkResource = checkResource;
function containsPlaceholder(str) {
    return (0, regex_1.regEx)(/\${.*?}/g).test(str);
}
function getMavenUrl(dependency, repoUrl, path) {
    return new URL(`${dependency.dependencyUrl}/${path}`, repoUrl);
}
exports.getMavenUrl = getMavenUrl;
async function downloadMavenXml(http, pkgUrl) {
    if (!pkgUrl) {
        return {};
    }
    let isCacheable = false;
    let rawContent;
    let authorization;
    let statusCode;
    switch (pkgUrl.protocol) {
        case 'http:':
        case 'https:':
            ({
                authorization,
                body: rawContent,
                statusCode,
            } = await downloadHttpProtocol(http, pkgUrl));
            break;
        case 's3:':
            rawContent = (await downloadS3Protocol(pkgUrl)) ?? undefined;
            break;
        default:
            logger_1.logger.debug({ url: pkgUrl.toString() }, `Unsupported Maven protocol`);
            return {};
    }
    if (!rawContent) {
        logger_1.logger.debug({ url: pkgUrl.toString(), statusCode }, `Content is not found for Maven url`);
        return {};
    }
    if (!authorization) {
        isCacheable = true;
    }
    return { isCacheable, xml: new xmldoc_1.XmlDocument(rawContent) };
}
exports.downloadMavenXml = downloadMavenXml;
function getDependencyParts(packageName) {
    const [group, name] = packageName.split(':');
    const dependencyUrl = `${group.replace((0, regex_1.regEx)(/\./g), '/')}/${name}`;
    return {
        display: packageName,
        group,
        name,
        dependencyUrl,
    };
}
exports.getDependencyParts = getDependencyParts;
function extractSnapshotVersion(metadata) {
    // Parse the maven-metadata.xml for the snapshot version and determine
    // the fixed version of the latest deployed snapshot.
    // The metadata descriptor can be found at
    // https://maven.apache.org/ref/3.3.3/maven-repository-metadata/repository-metadata.html
    //
    // Basically, we need to replace -SNAPSHOT with the artifact timestanp & build number,
    // so for example 1.0.0-SNAPSHOT will become 1.0.0-<timestamp>-<buildNumber>
    const version = metadata
        .descendantWithPath('version')
        ?.val?.replace('-SNAPSHOT', '');
    const snapshot = metadata.descendantWithPath('versioning.snapshot');
    const timestamp = snapshot?.childNamed('timestamp')?.val;
    const build = snapshot?.childNamed('buildNumber')?.val;
    // If we weren't able to parse out the required 3 version elements,
    // return null because we can't determine the fixed version of the latest snapshot.
    if (!version || !timestamp || !build) {
        return null;
    }
    return `${version}-${timestamp}-${build}`;
}
async function getSnapshotFullVersion(http, version, dependency, repoUrl) {
    // To determine what actual files are available for the snapshot, first we have to fetch and parse
    // the metadata located at http://<repo>/<group>/<artifact>/<version-SNAPSHOT>/maven-metadata.xml
    const metadataUrl = getMavenUrl(dependency, repoUrl, `${version}/maven-metadata.xml`);
    const { xml: mavenMetadata } = await downloadMavenXml(http, metadataUrl);
    if (!mavenMetadata) {
        return null;
    }
    return extractSnapshotVersion(mavenMetadata);
}
function isSnapshotVersion(version) {
    if (version.endsWith('-SNAPSHOT')) {
        return true;
    }
    return false;
}
async function createUrlForDependencyPom(http, version, dependency, repoUrl) {
    if (isSnapshotVersion(version)) {
        // By default, Maven snapshots are deployed to the repository with fixed file names.
        // Resolve the full, actual pom file name for the version.
        const fullVersion = await getSnapshotFullVersion(http, version, dependency, repoUrl);
        // If we were able to resolve the version, use that, otherwise fall back to using -SNAPSHOT
        if (fullVersion !== null) {
            return `${version}/${dependency.name}-${fullVersion}.pom`;
        }
    }
    return `${version}/${dependency.name}-${version}.pom`;
}
exports.createUrlForDependencyPom = createUrlForDependencyPom;
async function getDependencyInfo(http, dependency, repoUrl, version, recursionLimit = 5) {
    const result = {};
    const path = await createUrlForDependencyPom(http, version, dependency, repoUrl);
    const pomUrl = getMavenUrl(dependency, repoUrl, path);
    const { xml: pomContent } = await downloadMavenXml(http, pomUrl);
    // istanbul ignore if
    if (!pomContent) {
        return result;
    }
    const homepage = pomContent.valueWithPath('url');
    if (homepage && !containsPlaceholder(homepage)) {
        result.homepage = homepage;
    }
    const sourceUrl = pomContent.valueWithPath('scm.url');
    if (sourceUrl && !containsPlaceholder(sourceUrl)) {
        result.sourceUrl = sourceUrl
            .replace((0, regex_1.regEx)(/^scm:/), '')
            .replace((0, regex_1.regEx)(/^git:/), '')
            .replace((0, regex_1.regEx)(/^git@github.com:/), 'https://github.com/')
            .replace((0, regex_1.regEx)(/^git@github.com\//), 'https://github.com/')
            .replace((0, regex_1.regEx)(/\.git$/), '');
        if (result.sourceUrl.startsWith('//')) {
            // most likely the result of us stripping scm:, git: etc
            // going with prepending https: here which should result in potential information retrival
            result.sourceUrl = `https:${result.sourceUrl}`;
        }
    }
    const parent = pomContent.childNamed('parent');
    if (recursionLimit > 0 && parent && (!result.sourceUrl || !result.homepage)) {
        // if we found a parent and are missing some information
        // trying to get the scm/homepage information from it
        const [parentGroupId, parentArtifactId, parentVersion] = [
            'groupId',
            'artifactId',
            'version',
        ].map((k) => parent.valueWithPath(k)?.replace(/\s+/g, ''));
        if (parentGroupId && parentArtifactId && parentVersion) {
            const parentDisplayId = `${parentGroupId}:${parentArtifactId}`;
            const parentDependency = getDependencyParts(parentDisplayId);
            const parentInformation = await getDependencyInfo(http, parentDependency, repoUrl, parentVersion, recursionLimit - 1);
            if (!result.sourceUrl && parentInformation.sourceUrl) {
                result.sourceUrl = parentInformation.sourceUrl;
            }
            if (!result.homepage && parentInformation.homepage) {
                result.homepage = parentInformation.homepage;
            }
        }
    }
    return result;
}
exports.getDependencyInfo = getDependencyInfo;
//# sourceMappingURL=util.js.map