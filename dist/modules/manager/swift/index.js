"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultConfig = exports.supportedDatasources = exports.extractPackageFile = void 0;
const tslib_1 = require("tslib");
const git_tags_1 = require("../../datasource/git-tags");
const swiftVersioning = tslib_1.__importStar(require("../../versioning/swift"));
var extract_1 = require("./extract");
Object.defineProperty(exports, "extractPackageFile", { enumerable: true, get: function () { return extract_1.extractPackageFile; } });
exports.supportedDatasources = [git_tags_1.GitTagsDatasource.id];
exports.defaultConfig = {
    fileMatch: ['(^|/)Package\\.swift'],
    versioning: swiftVersioning.id,
    rangeStrategy: 'bump',
};
//# sourceMappingURL=index.js.map