"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerraformProviderHash = void 0;
const tslib_1 = require("tslib");
const crypto_1 = tslib_1.__importDefault(require("crypto"));
const extract_zip_1 = tslib_1.__importDefault(require("extract-zip"));
const p_map_1 = tslib_1.__importDefault(require("p-map"));
const upath_1 = tslib_1.__importDefault(require("upath"));
const logger_1 = require("../../../../logger");
const decorator_1 = require("../../../../util/cache/package/decorator");
const fs = tslib_1.__importStar(require("../../../../util/fs"));
const fs_1 = require("../../../../util/fs");
const http_1 = require("../../../../util/http");
const regex_1 = require("../../../../util/regex");
const terraform_provider_1 = require("../../../datasource/terraform-provider");
class TerraformProviderHash {
    static async hashFiles(files) {
        const rootHash = crypto_1.default.createHash('sha256');
        for (const file of files) {
            // build for every file a line looking like "aaaaaaaaaaaaaaa  file.txt\n"
            const hash = crypto_1.default.createHash('sha256');
            // a sha256sum displayed as lowercase hex string to root hash
            const fileBuffer = await fs.readFile(file);
            hash.update(fileBuffer);
            rootHash.update(hash.digest('hex'));
            // add double space, the filename and a new line char
            rootHash.update('  ');
            const fileName = file.replace((0, regex_1.regEx)(/^.*[\\/]/), '');
            rootHash.update(fileName);
            rootHash.update('\n');
        }
        return rootHash.digest('base64');
    }
    static async hashOfZipContent(zipFilePath, extractPath) {
        await (0, extract_zip_1.default)(zipFilePath, { dir: extractPath });
        const files = await fs.readdir(extractPath);
        // the h1 hashing algorithms requires that the files are sorted by filename
        const sortedFiles = files.sort((a, b) => a.localeCompare(b));
        const filesWithPath = sortedFiles.map((file) => `${extractPath}/${file}`);
        const result = await TerraformProviderHash.hashFiles(filesWithPath);
        // delete extracted files
        await fs.rm(extractPath, { recursive: true });
        return result;
    }
    static async calculateSingleHash(build, cacheDir) {
        const downloadFileName = upath_1.default.join(cacheDir, build.filename);
        const extractPath = upath_1.default.join(cacheDir, 'extract', build.filename);
        logger_1.logger.trace(`Downloading archive and generating hash for ${build.name}-${build.version}...`);
        const readStream = TerraformProviderHash.http.stream(build.url);
        const writeStream = fs.createWriteStream(downloadFileName);
        try {
            await fs.pipeline(readStream, writeStream);
            const hash = await this.hashOfZipContent(downloadFileName, extractPath);
            logger_1.logger.trace({ hash }, `Generated hash for ${build.name}-${build.version}`);
            return hash;
        }
        finally {
            // delete zip file
            await fs.unlink(downloadFileName);
        }
    }
    static async calculateHashes(builds) {
        const cacheDir = await (0, fs_1.ensureCacheDir)('./others/terraform');
        // for each build download ZIP, extract content and generate hash for all containing files
        return (0, p_map_1.default)(builds, (build) => this.calculateSingleHash(build, cacheDir), { concurrency: 4 } // allow to look up 4 builds for this version in parallel
        );
    }
    static async createHashes(registryURL, repository, version) {
        const builds = await TerraformProviderHash.terraformDatasource.getBuilds(registryURL, repository, version);
        if (!builds) {
            return null;
        }
        const hashes = await TerraformProviderHash.calculateHashes(builds);
        // sorting the hash alphabetically as terraform does this as well
        return hashes.sort().map((hash) => `h1:${hash}`);
    }
}
TerraformProviderHash.http = new http_1.Http(terraform_provider_1.TerraformProviderDatasource.id);
TerraformProviderHash.terraformDatasource = new terraform_provider_1.TerraformProviderDatasource();
TerraformProviderHash.hashCacheTTL = 10080; // in minutes == 1 week
tslib_1.__decorate([
    (0, decorator_1.cache)({
        namespace: `datasource-${terraform_provider_1.TerraformProviderDatasource.id}-build-hashes`,
        key: (build) => build.url,
        ttlMinutes: TerraformProviderHash.hashCacheTTL,
    })
], TerraformProviderHash, "calculateSingleHash", null);
exports.TerraformProviderHash = TerraformProviderHash;
//# sourceMappingURL=hash.js.map