"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportedDatasources = exports.defaultConfig = exports.extractPackageFile = void 0;
const tslib_1 = require("tslib");
const clojure_1 = require("../../datasource/clojure");
const mavenVersioning = tslib_1.__importStar(require("../../versioning/maven"));
const extract_1 = require("./extract");
Object.defineProperty(exports, "extractPackageFile", { enumerable: true, get: function () { return extract_1.extractPackageFile; } });
exports.defaultConfig = {
    fileMatch: ['(^|/)deps\\.edn$'],
    versioning: mavenVersioning.id,
};
exports.supportedDatasources = [clojure_1.ClojureDatasource.id];
//# sourceMappingURL=index.js.map