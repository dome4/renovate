"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMatchingFiles = exports.getFilteredFileList = exports.filterIgnoredFiles = exports.getIncludedFiles = void 0;
const tslib_1 = require("tslib");
const minimatch_1 = tslib_1.__importDefault(require("minimatch"));
const logger_1 = require("../../../logger");
const regex_1 = require("../../../util/regex");
function getIncludedFiles(fileList, includePaths) {
    if (!includePaths?.length) {
        return [...fileList];
    }
    return fileList.filter((file) => includePaths.some((includePath) => file === includePath || (0, minimatch_1.default)(file, includePath, { dot: true })));
}
exports.getIncludedFiles = getIncludedFiles;
function filterIgnoredFiles(fileList, ignorePaths) {
    if (!ignorePaths?.length) {
        return [...fileList];
    }
    return fileList.filter((file) => !ignorePaths.some((ignorePath) => file.includes(ignorePath) ||
        (0, minimatch_1.default)(file, ignorePath, { dot: true })));
}
exports.filterIgnoredFiles = filterIgnoredFiles;
function getFilteredFileList(config, fileList) {
    const { includePaths, ignorePaths } = config;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    let filteredList = getIncludedFiles(fileList, includePaths);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    filteredList = filterIgnoredFiles(filteredList, ignorePaths);
    return filteredList;
}
exports.getFilteredFileList = getFilteredFileList;
function getMatchingFiles(config, allFiles) {
    const fileList = getFilteredFileList(config, allFiles);
    const { fileMatch, manager } = config;
    let matchedFiles = [];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    for (const match of fileMatch) {
        logger_1.logger.debug(`Using file match: ${match} for manager ${manager}`);
        const re = (0, regex_1.regEx)(match);
        matchedFiles = matchedFiles.concat(fileList.filter((file) => re.test(file)));
    }
    // filter out duplicates
    return [...new Set(matchedFiles)].sort();
}
exports.getMatchingFiles = getMatchingFiles;
//# sourceMappingURL=file-match.js.map