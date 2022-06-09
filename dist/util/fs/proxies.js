"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rm = exports.readdir = exports.move = exports.pathExists = exports.exists = exports.unlink = exports.remove = exports.outputFile = exports.writeFile = exports.readFile = exports.chmod = exports.stat = void 0;
const tslib_1 = require("tslib");
const fs_extra_1 = tslib_1.__importDefault(require("fs-extra"));
// istanbul ignore next
function stat(path) {
    return fs_extra_1.default.stat(path);
}
exports.stat = stat;
// istanbul ignore next
function chmod(path, mode) {
    return fs_extra_1.default.chmod(path, mode);
}
exports.chmod = chmod;
function readFile(fileName, encoding) {
    return encoding ? fs_extra_1.default.readFile(fileName, encoding) : fs_extra_1.default.readFile(fileName);
}
exports.readFile = readFile;
// istanbul ignore next
function writeFile(fileName, fileContent) {
    return fs_extra_1.default.writeFile(fileName, fileContent);
}
exports.writeFile = writeFile;
// istanbul ignore next
function outputFile(file, data, options) {
    return fs_extra_1.default.outputFile(file, data, options ?? {});
}
exports.outputFile = outputFile;
function remove(dir) {
    return fs_extra_1.default.remove(dir);
}
exports.remove = remove;
// istanbul ignore next
function unlink(path) {
    return fs_extra_1.default.unlink(path);
}
exports.unlink = unlink;
// istanbul ignore next
function exists(path) {
    return fs_extra_1.default.pathExists(path);
}
exports.exists = exists;
// istanbul ignore next
function pathExists(path) {
    return fs_extra_1.default.pathExists(path);
}
exports.pathExists = pathExists;
// istanbul ignore next
function move(src, dest, options) {
    return fs_extra_1.default.move(src, dest, options ?? {});
}
exports.move = move;
// istanbul ignore next
function readdir(path) {
    return fs_extra_1.default.readdir(path);
}
exports.readdir = readdir;
// istanbul ignore next
function rm(path, options) {
    return fs_extra_1.default.rm(path, options);
}
exports.rm = rm;
//# sourceMappingURL=proxies.js.map