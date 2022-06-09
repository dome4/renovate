"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureCommentRemoval = exports.ensureComment = void 0;
const tslib_1 = require("tslib");
const hasha_1 = tslib_1.__importDefault(require("hasha"));
const repository_1 = require("../../util/cache/repository");
const _1 = require(".");
const hash = (content) => (0, hasha_1.default)(content, { algorithm: 'sha1' });
async function ensureComment(commentConfig) {
    var _a;
    const { number, content } = commentConfig;
    const topic = commentConfig.topic ?? '';
    const contentHash = hash(content);
    const repoCache = (0, repository_1.getCache)();
    if (contentHash !== repoCache.prComments?.[number]?.[topic]) {
        const res = await _1.platform.ensureComment(commentConfig);
        if (res) {
            repoCache.prComments ?? (repoCache.prComments = {});
            (_a = repoCache.prComments)[number] ?? (_a[number] = {});
            repoCache.prComments[number][topic] = contentHash;
        }
        return res;
    }
    return true;
}
exports.ensureComment = ensureComment;
async function ensureCommentRemoval(config) {
    await _1.platform.ensureCommentRemoval(config);
    const repoCache = (0, repository_1.getCache)();
    const { type, number } = config;
    if (repoCache.prComments?.[number]) {
        if (type === 'by-topic') {
            delete repoCache.prComments?.[number]?.[config.topic];
        }
        else if (type === 'by-content') {
            const contentHash = hash(config.content);
            for (const [cachedTopic, cachedContentHash] of Object.entries(repoCache.prComments?.[number])) {
                if (cachedContentHash === contentHash) {
                    delete repoCache.prComments?.[number]?.[cachedTopic];
                    return;
                }
            }
        }
    }
}
exports.ensureCommentRemoval = ensureCommentRemoval;
//# sourceMappingURL=comment.js.map