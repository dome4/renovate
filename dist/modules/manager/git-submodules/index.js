"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportedDatasources = exports.defaultConfig = exports.updateArtifacts = exports.updateDependency = exports.extractPackageFile = void 0;
const tslib_1 = require("tslib");
const git_refs_1 = require("../../datasource/git-refs");
const gitVersioning = tslib_1.__importStar(require("../../versioning/git"));
var extract_1 = require("./extract");
Object.defineProperty(exports, "extractPackageFile", { enumerable: true, get: function () { return tslib_1.__importDefault(extract_1).default; } });
var update_1 = require("./update");
Object.defineProperty(exports, "updateDependency", { enumerable: true, get: function () { return tslib_1.__importDefault(update_1).default; } });
var artifacts_1 = require("./artifacts");
Object.defineProperty(exports, "updateArtifacts", { enumerable: true, get: function () { return tslib_1.__importDefault(artifacts_1).default; } });
exports.defaultConfig = {
    enabled: false,
    versioning: gitVersioning.id,
    fileMatch: ['(^|/).gitmodules$'],
};
exports.supportedDatasources = [git_refs_1.GitRefsDatasource.id];
//# sourceMappingURL=index.js.map