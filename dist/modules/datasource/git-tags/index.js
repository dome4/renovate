"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitTagsDatasource = void 0;
const tslib_1 = require("tslib");
const decorator_1 = require("../../../util/cache/package/decorator");
const regex_1 = require("../../../util/regex");
const base_1 = require("../git-refs/base");
class GitTagsDatasource extends base_1.GitDatasource {
    constructor() {
        super(GitTagsDatasource.id);
        this.customRegistrySupport = false;
    }
    async getReleases({ packageName, }) {
        const rawRefs = await this.getRawRefs({ packageName });
        if (rawRefs === null) {
            return null;
        }
        const releases = rawRefs
            .filter((ref) => ref.type === 'tags')
            .map((ref) => ({
            version: ref.value,
            gitRef: ref.value,
            newDigest: ref.hash,
        }));
        const sourceUrl = packageName
            .replace((0, regex_1.regEx)(/\.git$/), '')
            .replace((0, regex_1.regEx)(/\/$/), '');
        const result = {
            sourceUrl,
            releases,
        };
        return result;
    }
    async getDigest({ packageName }, newValue) {
        const rawRefs = await this.getRawRefs({ packageName });
        const findValue = newValue || 'HEAD';
        const ref = rawRefs?.find((rawRef) => rawRef.value === findValue);
        if (ref) {
            return ref.hash;
        }
        return null;
    }
}
GitTagsDatasource.id = 'git-tags';
tslib_1.__decorate([
    (0, decorator_1.cache)({
        namespace: `datasource-${GitTagsDatasource.id}`,
        key: ({ packageName }) => packageName,
    })
], GitTagsDatasource.prototype, "getReleases", null);
exports.GitTagsDatasource = GitTagsDatasource;
//# sourceMappingURL=index.js.map