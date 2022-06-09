"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GolangVersionDatasource = void 0;
const tslib_1 = require("tslib");
const external_host_error_1 = require("../../../types/errors/external-host-error");
const decorator_1 = require("../../../util/cache/package/decorator");
const regex_1 = require("../../../util/regex");
const semver_1 = require("../../versioning/semver");
const datasource_1 = require("../datasource");
const lineTerminationRegex = (0, regex_1.regEx)(`\r?\n`);
const releaseBeginningChar = '\t{';
const releaseTerminationChar = '\t},';
const releaseDateRegex = (0, regex_1.regEx)(`Date\\{(?<year>\\d+),\\s+(?<month>\\d+),\\s+(?<day>\\d+)\\}`);
const releaseVersionRegex = (0, regex_1.regEx)(`Version\\{(?<versionMajor>\\d+),\\s+(?<versionMinor>\\d+),\\s+(?<patch>\\d+)\\}`);
const releaseFutureRegex = (0, regex_1.regEx)(`Future:\\s+true`);
class GolangVersionDatasource extends datasource_1.Datasource {
    constructor() {
        super(GolangVersionDatasource.id);
        this.defaultRegistryUrls = [
            'https://raw.githubusercontent.com/golang/website/',
        ];
        this.customRegistrySupport = false;
        this.defaultVersioning = semver_1.id;
    }
    async getReleases({ registryUrl, }) {
        const res = {
            homepage: 'https://go.dev/',
            sourceUrl: 'https://github.com/golang/go',
            releases: [],
        };
        const golangVersionsUrl = `${registryUrl}master/internal/history/release.go`;
        const response = await this.http.get(golangVersionsUrl);
        const lines = response.body.split(lineTerminationRegex);
        const startOfReleases = lines.indexOf('var Releases = []*Release{');
        if (startOfReleases === -1) {
            throw new external_host_error_1.ExternalHostError(new Error('Invalid file - could not find the Releases section'));
        }
        // Remove part before releases
        lines.splice(0, startOfReleases + 1);
        // Parse the release list
        let release = {
            version: undefined,
        };
        let skipFutureRelease = false;
        while (lines.length !== 0) {
            const line = lines.shift();
            if (line === releaseBeginningChar) {
                if (release.version !== undefined) {
                    throw new external_host_error_1.ExternalHostError(new Error('Invalid file - unexpected error while parsing a release'));
                }
            }
            else if (line === releaseTerminationChar) {
                if (skipFutureRelease) {
                    skipFutureRelease = false;
                }
                else {
                    if (release.version === undefined) {
                        throw new external_host_error_1.ExternalHostError(new Error('Invalid file - release has empty version'));
                    }
                    res.releases.push(release);
                }
                release = { version: undefined };
            }
            else {
                const isFutureRelease = releaseFutureRegex.test(line);
                if (isFutureRelease) {
                    skipFutureRelease = true;
                }
                const releaseDateMatch = releaseDateRegex.exec(line);
                if (releaseDateMatch?.groups) {
                    // Make a valid UTC timestamp
                    const year = releaseDateMatch.groups.year.padStart(4, '0');
                    const month = releaseDateMatch.groups.month.padStart(2, '0');
                    const day = releaseDateMatch.groups.day.padStart(2, '0');
                    release.releaseTimestamp = `${year}-${month}-${day}T00:00:00.000Z`;
                }
                const releaseVersionMatch = releaseVersionRegex.exec(line);
                if (releaseVersionMatch?.groups) {
                    release.version = `${releaseVersionMatch.groups.versionMajor}.${releaseVersionMatch.groups.versionMinor}.${releaseVersionMatch.groups.patch}`;
                    if (!(0, semver_1.isVersion)(release.version)) {
                        throw new external_host_error_1.ExternalHostError(new Error(`Version ${release.version} is not a valid semver`));
                    }
                }
            }
        }
        if (res.releases.length === 0) {
            throw new external_host_error_1.ExternalHostError(new Error(`Invalid file - zero releases extracted`));
        }
        return res;
    }
}
GolangVersionDatasource.id = 'golang-version';
tslib_1.__decorate([
    (0, decorator_1.cache)({ namespace: `datasource-${GolangVersionDatasource.id}`, key: 'all' })
], GolangVersionDatasource.prototype, "getReleases", null);
exports.GolangVersionDatasource = GolangVersionDatasource;
//# sourceMappingURL=index.js.map