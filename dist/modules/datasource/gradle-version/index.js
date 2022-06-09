"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GradleVersionDatasource = void 0;
const tslib_1 = require("tslib");
const decorator_1 = require("../../../util/cache/package/decorator");
const regex_1 = require("../../../util/regex");
const gradleVersioning = tslib_1.__importStar(require("../../versioning/gradle"));
const datasource_1 = require("../datasource");
class GradleVersionDatasource extends datasource_1.Datasource {
    constructor() {
        super(GradleVersionDatasource.id);
        this.defaultRegistryUrls = [
            'https://services.gradle.org/versions/all',
        ];
        this.defaultVersioning = gradleVersioning.id;
        this.registryStrategy = 'merge';
    }
    async getReleases({ registryUrl, }) {
        // istanbul ignore if
        if (!registryUrl) {
            return null;
        }
        let releases;
        try {
            const response = await this.http.getJson(registryUrl);
            releases = response.body
                .filter((release) => !release.snapshot && !release.nightly)
                .map((release) => ({
                version: release.version,
                releaseTimestamp: GradleVersionDatasource.formatBuildTime(release.buildTime),
                ...(release.broken && { isDeprecated: release.broken }),
            }));
        }
        catch (err) {
            this.handleGenericErrors(err);
        }
        const res = {
            releases,
            homepage: 'https://gradle.org',
            sourceUrl: 'https://github.com/gradle/gradle',
        };
        if (res.releases.length) {
            return res;
        }
        return null;
    }
    static formatBuildTime(timeStr) {
        if (!timeStr) {
            return null;
        }
        if (GradleVersionDatasource.buildTimeRegex.test(timeStr)) {
            return timeStr.replace(GradleVersionDatasource.buildTimeRegex, '$1-$2-$3T$4:$5:$6$7');
        }
        return null;
    }
}
GradleVersionDatasource.id = 'gradle-version';
GradleVersionDatasource.buildTimeRegex = (0, regex_1.regEx)('^(\\d\\d\\d\\d)(\\d\\d)(\\d\\d)(\\d\\d)(\\d\\d)(\\d\\d)(\\+\\d\\d\\d\\d)$');
tslib_1.__decorate([
    (0, decorator_1.cache)({
        namespace: `datasource-${GradleVersionDatasource.id}`,
        key: ({ registryUrl }) => `${registryUrl}`,
    })
], GradleVersionDatasource.prototype, "getReleases", null);
exports.GradleVersionDatasource = GradleVersionDatasource;
//# sourceMappingURL=index.js.map