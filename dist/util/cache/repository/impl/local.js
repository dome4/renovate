"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalRepoCache = void 0;
const tslib_1 = require("tslib");
const util_1 = require("util");
const zlib_1 = tslib_1.__importDefault(require("zlib"));
const hasha_1 = tslib_1.__importDefault(require("hasha"));
const upath_1 = tslib_1.__importDefault(require("upath"));
const global_1 = require("../../../../config/global");
const logger_1 = require("../../../../logger");
const fs_1 = require("../../../fs");
const common_1 = require("../common");
const base_1 = require("./base");
const compress = (0, util_1.promisify)(zlib_1.default.brotliCompress);
const decompress = (0, util_1.promisify)(zlib_1.default.brotliDecompress);
class LocalRepoCache extends base_1.RepoCacheBase {
    constructor(platform, repository) {
        super();
        this.platform = platform;
        this.repository = repository;
        this.oldHash = null;
    }
    getCacheFileName() {
        const cacheDir = global_1.GlobalConfig.get('cacheDir');
        const repoCachePath = '/renovate/repository/';
        const platform = this.platform;
        const fileName = `${this.repository}.json`;
        return upath_1.default.join(cacheDir, repoCachePath, platform, fileName);
    }
    async load() {
        const cacheFileName = this.getCacheFileName();
        try {
            const cacheFileName = this.getCacheFileName();
            const rawCache = await (0, fs_1.readFile)(cacheFileName, 'utf8');
            const oldCache = JSON.parse(rawCache);
            if ((0, common_1.isValidRev12)(oldCache, this.repository)) {
                const compressed = Buffer.from(oldCache.payload, 'base64');
                const uncompressed = await decompress(compressed);
                const jsonStr = uncompressed.toString('utf8');
                this.data = JSON.parse(jsonStr);
                this.oldHash = oldCache.hash;
                logger_1.logger.debug('Repository cache is valid');
                return;
            }
            if ((0, common_1.isValidRev11)(oldCache, this.repository)) {
                this.data = oldCache.data;
                logger_1.logger.debug('Repository cache is migrated from 11 revision');
                return;
            }
            if ((0, common_1.isValidRev10)(oldCache, this.repository)) {
                delete oldCache.repository;
                delete oldCache.revision;
                this.data = oldCache;
                logger_1.logger.debug('Repository cache is migrated from 10 revision');
                return;
            }
            logger_1.logger.debug('Repository cache is invalid');
        }
        catch (err) {
            logger_1.logger.debug({ cacheFileName }, 'Repository cache not found');
        }
    }
    async save() {
        const cacheFileName = this.getCacheFileName();
        const revision = common_1.CACHE_REVISION;
        const repository = this.repository;
        const data = this.getData();
        const jsonStr = JSON.stringify(data);
        const hash = await hasha_1.default.async(jsonStr, { algorithm: 'sha256' });
        if (hash !== this.oldHash) {
            const compressed = await compress(jsonStr);
            const payload = compressed.toString('base64');
            const record = { revision, repository, payload, hash };
            await (0, fs_1.outputFile)(cacheFileName, JSON.stringify(record));
        }
    }
}
exports.LocalRepoCache = LocalRepoCache;
//# sourceMappingURL=local.js.map