"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportedDatasources = exports.defaultConfig = exports.supportsLockFileMaintenance = exports.extractPackageFile = exports.updateArtifacts = void 0;
const git_tags_1 = require("../../datasource/git-tags");
var artifacts_1 = require("./artifacts");
Object.defineProperty(exports, "updateArtifacts", { enumerable: true, get: function () { return artifacts_1.updateArtifacts; } });
var extract_1 = require("./extract");
Object.defineProperty(exports, "extractPackageFile", { enumerable: true, get: function () { return extract_1.extractPackageFile; } });
exports.supportsLockFileMaintenance = true;
exports.defaultConfig = {
    fileMatch: ['(^|/)jsonnetfile.json$'],
    datasource: git_tags_1.GitTagsDatasource.id,
};
exports.supportedDatasources = [git_tags_1.GitTagsDatasource.id];
//# sourceMappingURL=index.js.map