"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoDatasource = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const decorator_1 = require("../../../util/cache/package/decorator");
const sanitize_1 = require("../../../util/sanitize");
const url_1 = require("../../../util/url");
const bitbucket_tags_1 = require("../bitbucket-tags");
const datasource_1 = require("../datasource");
const github_tags_1 = require("../github-tags");
const gitlab_tags_1 = require("../gitlab-tags");
const base_1 = require("./base");
const releases_direct_1 = require("./releases-direct");
const releases_goproxy_1 = require("./releases-goproxy");
class GoDatasource extends datasource_1.Datasource {
    constructor() {
        super(GoDatasource.id);
        this.customRegistrySupport = false;
        this.goproxy = new releases_goproxy_1.GoProxyDatasource();
        this.direct = new releases_direct_1.GoDirectDatasource();
    }
    getReleases(config) {
        return process.env.GOPROXY
            ? this.goproxy.getReleases(config)
            : this.direct.getReleases(config);
    }
    /**
     * go.getDigest
     *
     * This datasource resolves a go module URL into its source repository
     *  and then fetches the digest it if it is on GitHub.
     *
     * This function will:
     *  - Determine the source URL for the module
     *  - Call the respective getDigest in github to retrieve the commit hash
     */
    async getDigest({ packageName }, value) {
        const source = await base_1.BaseGoDatasource.getDatasource(packageName);
        if (!source) {
            return null;
        }
        // ignore v0.0.0- pseudo versions that are used Go Modules - look up default branch instead
        const tag = value && !value.startsWith('v0.0.0-2') ? value : undefined;
        switch (source.datasource) {
            case github_tags_1.GithubTagsDatasource.id: {
                return this.direct.github.getDigest(source, tag);
            }
            case bitbucket_tags_1.BitBucketTagsDatasource.id: {
                return this.direct.bitbucket.getDigest?.(source, tag) ?? null;
            }
            case gitlab_tags_1.GitlabTagsDatasource.id: {
                return this.direct.gitlab.getDigest?.(source, tag) ?? null;
            }
            /* istanbul ignore next: can never happen, makes lint happy */
            default: {
                return null;
            }
        }
    }
}
GoDatasource.id = 'go';
tslib_1.__decorate([
    (0, decorator_1.cache)({
        namespace: `datasource-${GoDatasource.id}`,
        key: ({ packageName }) => `${packageName}-digest`,
    })
], GoDatasource.prototype, "getReleases", null);
tslib_1.__decorate([
    (0, decorator_1.cache)({
        namespace: GoDatasource.id,
        key: ({ packageName }) => `${packageName}-digest`,
    })
], GoDatasource.prototype, "getDigest", null);
exports.GoDatasource = GoDatasource;
// istanbul ignore if
if (is_1.default.string(process.env.GOPROXY)) {
    const uri = (0, url_1.parseUrl)(process.env.GOPROXY);
    if (uri?.username) {
        (0, sanitize_1.addSecretForSanitizing)(uri.username, 'global');
    }
    if (uri?.password) {
        (0, sanitize_1.addSecretForSanitizing)(uri.password, 'global');
    }
}
//# sourceMappingURL=index.js.map