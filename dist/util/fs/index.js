"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findUpLocal = exports.localPathIsFile = exports.createWriteStream = exports.readLocalDirectory = exports.findLocalSiblingOrParent = exports.localPathExists = exports.privateCacheDir = exports.ensureCacheDir = exports.ensureLocalDir = exports.ensureDir = exports.renameLocalFile = exports.deleteLocalFile = exports.writeLocalFile = exports.readLocalFile = exports.getSiblingFileName = exports.getSubDirectory = exports.pipeline = void 0;
const tslib_1 = require("tslib");
const stream_1 = tslib_1.__importDefault(require("stream"));
const util_1 = tslib_1.__importDefault(require("util"));
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const find_up_1 = tslib_1.__importDefault(require("find-up"));
const fs_extra_1 = tslib_1.__importDefault(require("fs-extra"));
const upath_1 = tslib_1.__importDefault(require("upath"));
const global_1 = require("../../config/global");
const logger_1 = require("../../logger");
tslib_1.__exportStar(require("./proxies"), exports);
exports.pipeline = util_1.default.promisify(stream_1.default.pipeline);
function getSubDirectory(fileName) {
    return upath_1.default.parse(fileName).dir;
}
exports.getSubDirectory = getSubDirectory;
function getSiblingFileName(existingFileNameWithPath, otherFileName) {
    const subDirectory = getSubDirectory(existingFileNameWithPath);
    return upath_1.default.join(subDirectory, otherFileName);
}
exports.getSiblingFileName = getSiblingFileName;
async function readLocalFile(fileName, encoding) {
    const { localDir } = global_1.GlobalConfig.get();
    const localFileName = upath_1.default.join(localDir, fileName);
    try {
        const fileContent = encoding
            ? await fs_extra_1.default.readFile(localFileName, encoding)
            : await fs_extra_1.default.readFile(localFileName);
        return fileContent;
    }
    catch (err) {
        logger_1.logger.trace({ err }, 'Error reading local file');
        return null;
    }
}
exports.readLocalFile = readLocalFile;
async function writeLocalFile(fileName, fileContent) {
    const { localDir } = global_1.GlobalConfig.get();
    const localFileName = upath_1.default.join(localDir, fileName);
    await fs_extra_1.default.outputFile(localFileName, fileContent);
}
exports.writeLocalFile = writeLocalFile;
async function deleteLocalFile(fileName) {
    const { localDir } = global_1.GlobalConfig.get();
    if (localDir) {
        const localFileName = upath_1.default.join(localDir, fileName);
        await fs_extra_1.default.remove(localFileName);
    }
}
exports.deleteLocalFile = deleteLocalFile;
// istanbul ignore next
async function renameLocalFile(fromFile, toFile) {
    const { localDir } = global_1.GlobalConfig.get();
    await fs_extra_1.default.move(upath_1.default.join(localDir, fromFile), upath_1.default.join(localDir, toFile));
}
exports.renameLocalFile = renameLocalFile;
// istanbul ignore next
async function ensureDir(dirName) {
    if (is_1.default.nonEmptyString(dirName)) {
        await fs_extra_1.default.ensureDir(dirName);
    }
}
exports.ensureDir = ensureDir;
// istanbul ignore next
async function ensureLocalDir(dirName) {
    const { localDir } = global_1.GlobalConfig.get();
    const localDirName = upath_1.default.join(localDir, dirName);
    await fs_extra_1.default.ensureDir(localDirName);
}
exports.ensureLocalDir = ensureLocalDir;
async function ensureCacheDir(name) {
    const cacheDirName = upath_1.default.join(global_1.GlobalConfig.get('cacheDir'), `others/${name}`);
    await fs_extra_1.default.ensureDir(cacheDirName);
    return cacheDirName;
}
exports.ensureCacheDir = ensureCacheDir;
/**
 * Return the path of the private cache directory. This directory is wiped
 * between repositories, so they can be used to store private registries' index
 * without risk of that information leaking to other repositories/users.
 */
function privateCacheDir() {
    const { cacheDir } = global_1.GlobalConfig.get();
    return upath_1.default.join(cacheDir, '__renovate-private-cache');
}
exports.privateCacheDir = privateCacheDir;
function localPathExists(pathName) {
    const { localDir } = global_1.GlobalConfig.get();
    // Works for both files as well as directories
    return fs_extra_1.default
        .stat(upath_1.default.join(localDir, pathName))
        .then((s) => !!s)
        .catch(() => false);
}
exports.localPathExists = localPathExists;
/**
 * Tries to find `otherFileName` in the directory where
 * `existingFileNameWithPath` is, then in its parent directory, then in the
 * grandparent, until we reach the top-level directory. All paths
 * must be relative to `localDir`.
 */
async function findLocalSiblingOrParent(existingFileNameWithPath, otherFileName) {
    if (upath_1.default.isAbsolute(existingFileNameWithPath)) {
        return null;
    }
    if (upath_1.default.isAbsolute(otherFileName)) {
        return null;
    }
    let current = existingFileNameWithPath;
    while (current !== '') {
        current = getSubDirectory(current);
        const candidate = upath_1.default.join(current, otherFileName);
        if (await localPathExists(candidate)) {
            return candidate;
        }
    }
    return null;
}
exports.findLocalSiblingOrParent = findLocalSiblingOrParent;
/**
 * Get files by name from directory
 */
async function readLocalDirectory(path) {
    const { localDir } = global_1.GlobalConfig.get();
    const localPath = upath_1.default.join(localDir, path);
    const fileList = await fs_extra_1.default.readdir(localPath);
    return fileList;
}
exports.readLocalDirectory = readLocalDirectory;
function createWriteStream(path) {
    return fs_extra_1.default.createWriteStream(path);
}
exports.createWriteStream = createWriteStream;
function localPathIsFile(pathName) {
    const { localDir } = global_1.GlobalConfig.get();
    return fs_extra_1.default
        .stat(upath_1.default.join(localDir, pathName))
        .then((s) => s.isFile())
        .catch(() => false);
}
exports.localPathIsFile = localPathIsFile;
/**
 * Find a file or directory by walking up parent directories within localDir
 */
async function findUpLocal(fileName, cwd) {
    const { localDir } = global_1.GlobalConfig.get();
    const absoluteCwd = upath_1.default.join(localDir, cwd);
    const normalizedAbsoluteCwd = upath_1.default.normalizeSafe(absoluteCwd);
    const res = await (0, find_up_1.default)(fileName, {
        cwd: normalizedAbsoluteCwd,
        type: 'file',
    });
    // Return null if nothing found
    if (!is_1.default.nonEmptyString(res) || !is_1.default.nonEmptyString(localDir)) {
        return null;
    }
    const safePath = upath_1.default.normalizeSafe(res);
    // Return relative path if file is inside of local dir
    if (safePath.startsWith(localDir)) {
        let relativePath = safePath.replace(localDir, '');
        if (relativePath.startsWith('/')) {
            relativePath = relativePath.substring(1);
        }
        return relativePath;
    }
    // Return null if found file is outside of localDir
    return null;
}
exports.findUpLocal = findUpLocal;
//# sourceMappingURL=index.js.map