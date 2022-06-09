"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitRefsDatasource = void 0;
const tslib_1 = require("tslib");
const decorator_1 = require("../../../util/cache/package/decorator");
const regex_1 = require("../../../util/regex");
const base_1 = require("./base");
// git will prompt for known hosts or passwords, unless we activate BatchMode
process.env.GIT_SSH_COMMAND = 'ssh -o BatchMode=yes';
class GitRefsDatasource extends base_1.GitDatasource {
    constructor() {
        super(GitRefsDatasource.id);
        this.customRegistrySupport = false;
    }
    async getReleases({ packageName, }) {
        const rawRefs = await this.getRawRefs({ packageName });
        if (!rawRefs) {
            return null;
        }
        const refs = rawRefs
            .filter((ref) => ref.type === 'tags' || ref.type === 'heads')
            .map((ref) => ref.value);
        const uniqueRefs = [...new Set(refs)];
        const sourceUrl = packageName
            .replace((0, regex_1.regEx)(/\.git$/), '')
            .replace((0, regex_1.regEx)(/\/$/), '');
        const result = {
            sourceUrl,
            releases: uniqueRefs.map((ref) => ({
                version: ref,
                gitRef: ref,
                newDigest: rawRefs.find((rawRef) => rawRef.value === ref)?.hash,
            })),
        };
        return result;
    }
    async getDigest({ packageName }, newValue) {
        const rawRefs = await this.getRawRefs({ packageName });
        // istanbul ignore if
        if (!rawRefs) {
            return null;
        }
        let ref;
        if (newValue) {
            ref = rawRefs.find((rawRef) => ['heads', 'tags'].includes(rawRef.type) && rawRef.value === newValue);
        }
        else {
            ref = rawRefs.find((rawRef) => rawRef.type === '' && rawRef.value === 'HEAD');
        }
        if (ref) {
            return ref.hash;
        }
        return null;
    }
}
GitRefsDatasource.id = 'git-refs';
tslib_1.__decorate([
    (0, decorator_1.cache)({
        namespace: `datasource-${GitRefsDatasource.id}`,
        key: ({ packageName }) => packageName,
    })
], GitRefsDatasource.prototype, "getReleases", null);
exports.GitRefsDatasource = GitRefsDatasource;
//# sourceMappingURL=index.js.map