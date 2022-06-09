"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportedDatasources = exports.defaultConfig = exports.extractPackageFile = void 0;
const galaxy_collection_1 = require("../../datasource/galaxy-collection");
const git_tags_1 = require("../../datasource/git-tags");
const github_tags_1 = require("../../datasource/github-tags");
var extract_1 = require("./extract");
Object.defineProperty(exports, "extractPackageFile", { enumerable: true, get: function () { return extract_1.extractPackageFile; } });
exports.defaultConfig = {
    fileMatch: ['(^|/)requirements\\.ya?ml$', '(^|/)galaxy\\.ya?ml$'],
};
exports.supportedDatasources = [
    galaxy_collection_1.GalaxyCollectionDatasource.id,
    git_tags_1.GitTagsDatasource.id,
    github_tags_1.GithubTagsDatasource.id,
];
//# sourceMappingURL=index.js.map