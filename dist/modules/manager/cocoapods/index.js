"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportedDatasources = exports.defaultConfig = exports.updateArtifacts = exports.extractPackageFile = void 0;
const tslib_1 = require("tslib");
const git_tags_1 = require("../../datasource/git-tags");
const github_tags_1 = require("../../datasource/github-tags");
const gitlab_tags_1 = require("../../datasource/gitlab-tags");
const pod_1 = require("../../datasource/pod");
const rubyVersioning = tslib_1.__importStar(require("../../versioning/ruby"));
var extract_1 = require("./extract");
Object.defineProperty(exports, "extractPackageFile", { enumerable: true, get: function () { return extract_1.extractPackageFile; } });
var artifacts_1 = require("./artifacts");
Object.defineProperty(exports, "updateArtifacts", { enumerable: true, get: function () { return artifacts_1.updateArtifacts; } });
exports.defaultConfig = {
    fileMatch: ['(^|/)Podfile$'],
    versioning: rubyVersioning.id,
};
exports.supportedDatasources = [
    git_tags_1.GitTagsDatasource.id,
    github_tags_1.GithubTagsDatasource.id,
    gitlab_tags_1.GitlabTagsDatasource.id,
    pod_1.PodDatasource.id,
];
//# sourceMappingURL=index.js.map