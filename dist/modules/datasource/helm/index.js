"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HelmDatasource = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const js_yaml_1 = require("js-yaml");
const logger_1 = require("../../../logger");
const decorator_1 = require("../../../util/cache/package/decorator");
const url_1 = require("../../../util/url");
const helmVersioning = tslib_1.__importStar(require("../../versioning/helm"));
const datasource_1 = require("../datasource");
const common_1 = require("./common");
class HelmDatasource extends datasource_1.Datasource {
    constructor() {
        super(HelmDatasource.id);
        this.defaultRegistryUrls = ['https://charts.helm.sh/stable'];
        this.defaultConfig = {
            commitMessageTopic: 'Helm release {{depName}}',
            group: {
                commitMessageTopic: '{{{groupName}}} Helm releases',
            },
        };
        this.defaultVersioning = helmVersioning.id;
    }
    async getRepositoryData(helmRepository) {
        let res;
        try {
            res = await this.http.get('index.yaml', {
                baseUrl: (0, url_1.ensureTrailingSlash)(helmRepository),
            });
            if (!res || !res.body) {
                logger_1.logger.warn({ helmRepository }, `Received invalid response from helm repository`);
                return null;
            }
        }
        catch (err) {
            this.handleGenericErrors(err);
        }
        try {
            const doc = (0, js_yaml_1.load)(res.body, {
                json: true,
            });
            if (!is_1.default.plainObject(doc)) {
                logger_1.logger.warn({ helmRepository }, `Failed to parse index.yaml from helm repository`);
                return null;
            }
            const result = {};
            for (const [name, releases] of Object.entries(doc.entries)) {
                const { sourceUrl, sourceDirectory } = (0, common_1.findSourceUrl)(releases[0]);
                result[name] = {
                    homepage: releases[0].home,
                    sourceUrl,
                    sourceDirectory,
                    releases: releases.map((release) => ({
                        version: release.version,
                        releaseTimestamp: release.created ?? null,
                    })),
                };
            }
            return result;
        }
        catch (err) {
            logger_1.logger.warn({ helmRepository }, `Failed to parse index.yaml from helm repository`);
            logger_1.logger.debug(err);
            return null;
        }
    }
    async getReleases({ packageName, registryUrl: helmRepository, }) {
        // istanbul ignore if
        if (!helmRepository) {
            return null;
        }
        const repositoryData = await this.getRepositoryData(helmRepository);
        if (!repositoryData) {
            logger_1.logger.debug(`Couldn't get index.yaml file from ${helmRepository}`);
            return null;
        }
        const releases = repositoryData[packageName];
        if (!releases) {
            logger_1.logger.debug({ dependency: packageName }, `Entry ${packageName} doesn't exist in index.yaml from ${helmRepository}`);
            return null;
        }
        return releases;
    }
}
HelmDatasource.id = 'helm';
tslib_1.__decorate([
    (0, decorator_1.cache)({
        namespace: `datasource-${HelmDatasource.id}`,
        key: (helmRepository) => helmRepository,
    })
], HelmDatasource.prototype, "getRepositoryData", null);
exports.HelmDatasource = HelmDatasource;
//# sourceMappingURL=index.js.map