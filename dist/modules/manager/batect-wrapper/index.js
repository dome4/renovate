"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportedDatasources = exports.defaultConfig = exports.updateArtifacts = exports.extractPackageFile = void 0;
const github_releases_1 = require("../../datasource/github-releases");
const semver_1 = require("../../versioning/semver");
var extract_1 = require("./extract");
Object.defineProperty(exports, "extractPackageFile", { enumerable: true, get: function () { return extract_1.extractPackageFile; } });
var artifacts_1 = require("./artifacts");
Object.defineProperty(exports, "updateArtifacts", { enumerable: true, get: function () { return artifacts_1.updateArtifacts; } });
exports.defaultConfig = {
    fileMatch: ['(^|/)batect$'],
    versioning: semver_1.id,
};
exports.supportedDatasources = [github_releases_1.GithubReleasesDatasource.id];
//# sourceMappingURL=index.js.map