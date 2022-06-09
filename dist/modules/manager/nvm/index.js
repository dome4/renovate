"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportedDatasources = exports.defaultConfig = exports.language = exports.extractPackageFile = void 0;
const tslib_1 = require("tslib");
const constants_1 = require("../../../constants");
const github_tags_1 = require("../../datasource/github-tags");
const nodeVersioning = tslib_1.__importStar(require("../../versioning/node"));
var extract_1 = require("./extract");
Object.defineProperty(exports, "extractPackageFile", { enumerable: true, get: function () { return extract_1.extractPackageFile; } });
exports.language = constants_1.ProgrammingLanguage.NodeJS;
exports.defaultConfig = {
    fileMatch: ['(^|/)\\.nvmrc$'],
    versioning: nodeVersioning.id,
    pinDigests: false,
};
exports.supportedDatasources = [github_tags_1.GithubTagsDatasource.id];
//# sourceMappingURL=index.js.map