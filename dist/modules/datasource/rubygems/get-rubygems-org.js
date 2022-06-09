"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RubyGemsOrgDatasource = exports.resetCache = void 0;
const logger_1 = require("../../../logger");
const external_host_error_1 = require("../../../types/errors/external-host-error");
const date_1 = require("../../../util/date");
const regex_1 = require("../../../util/regex");
const datasource_1 = require("../datasource");
let lastSync = new Date('2000-01-01');
let packageReleases = Object.create(null); // Because we might need a "constructor" key
let contentLength = 0;
// Note: use only for tests
function resetCache() {
    lastSync = new Date('2000-01-01');
    packageReleases = Object.create(null);
    contentLength = 0;
}
exports.resetCache = resetCache;
class RubyGemsOrgDatasource extends datasource_1.Datasource {
    constructor(id) {
        super(id);
        this.id = id;
        this.updateRubyGemsVersionsPromise = null;
    }
    async getReleases({ packageName, }) {
        logger_1.logger.debug(`getRubygemsOrgDependency(${packageName})`);
        await this.syncVersions();
        if (!packageReleases[packageName]) {
            return null;
        }
        const dep = {
            releases: packageReleases[packageName].map((version) => ({
                version,
            })),
        };
        return dep;
    }
    /**
     * https://bugs.chromium.org/p/v8/issues/detail?id=2869
     */
    static copystr(x) {
        return (' ' + x).slice(1);
    }
    async updateRubyGemsVersions() {
        const url = 'https://rubygems.org/versions';
        const options = {
            headers: {
                'accept-encoding': 'identity',
                range: `bytes=${contentLength}-`,
            },
        };
        let newLines;
        try {
            logger_1.logger.debug('Rubygems: Fetching rubygems.org versions');
            const startTime = Date.now();
            newLines = (await this.http.get(url, options)).body;
            const durationMs = Math.round(Date.now() - startTime);
            logger_1.logger.debug({ durationMs }, 'Rubygems: Fetched rubygems.org versions');
        }
        catch (err) /* istanbul ignore next */ {
            if (err.statusCode !== 416) {
                contentLength = 0;
                packageReleases = Object.create(null); // Because we might need a "constructor" key
                logger_1.logger.debug({ err }, 'Rubygems fetch error');
                throw new external_host_error_1.ExternalHostError(new Error('Rubygems fetch error'));
            }
            logger_1.logger.debug('Rubygems: No update');
            lastSync = new Date();
            return;
        }
        for (const line of newLines.split(regex_1.newlineRegex)) {
            RubyGemsOrgDatasource.processLine(line);
        }
        lastSync = new Date();
    }
    static processLine(line) {
        let split;
        let pkg;
        let versions;
        try {
            const l = line.trim();
            if (!l.length || l.startsWith('created_at:') || l === '---') {
                return;
            }
            split = l.split(' ');
            [pkg, versions] = split;
            pkg = RubyGemsOrgDatasource.copystr(pkg);
            packageReleases[pkg] = packageReleases[pkg] || [];
            const lineVersions = versions.split(',').map((version) => version.trim());
            for (const lineVersion of lineVersions) {
                if (lineVersion.startsWith('-')) {
                    const deletedVersion = lineVersion.slice(1);
                    logger_1.logger.trace({ pkg, deletedVersion }, 'Rubygems: Deleting version');
                    packageReleases[pkg] = packageReleases[pkg].filter((version) => version !== deletedVersion);
                }
                else {
                    packageReleases[pkg].push(RubyGemsOrgDatasource.copystr(lineVersion));
                }
            }
        }
        catch (err) /* istanbul ignore next */ {
            logger_1.logger.warn({ err, line, split, pkg, versions }, 'Rubygems line parsing error');
        }
    }
    static isDataStale() {
        return (0, date_1.getElapsedMinutes)(lastSync) >= 5;
    }
    async syncVersions() {
        if (RubyGemsOrgDatasource.isDataStale()) {
            this.updateRubyGemsVersionsPromise =
                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                this.updateRubyGemsVersionsPromise || this.updateRubyGemsVersions();
            await this.updateRubyGemsVersionsPromise;
            this.updateRubyGemsVersionsPromise = null;
        }
    }
}
exports.RubyGemsOrgDatasource = RubyGemsOrgDatasource;
//# sourceMappingURL=get-rubygems-org.js.map