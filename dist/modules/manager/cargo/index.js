"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportedDatasources = exports.defaultConfig = exports.language = exports.updateArtifacts = exports.extractPackageFile = exports.supportsLockFileMaintenance = void 0;
const tslib_1 = require("tslib");
const constants_1 = require("../../../constants");
const crate_1 = require("../../datasource/crate");
const cargoVersioning = tslib_1.__importStar(require("../../versioning/cargo"));
const artifacts_1 = require("./artifacts");
Object.defineProperty(exports, "updateArtifacts", { enumerable: true, get: function () { return artifacts_1.updateArtifacts; } });
const extract_1 = require("./extract");
Object.defineProperty(exports, "extractPackageFile", { enumerable: true, get: function () { return extract_1.extractPackageFile; } });
const language = constants_1.ProgrammingLanguage.Rust;
exports.language = language;
exports.supportsLockFileMaintenance = true;
exports.defaultConfig = {
    commitMessageTopic: 'Rust crate {{depName}}',
    fileMatch: ['(^|/)Cargo.toml$'],
    versioning: cargoVersioning.id,
    rangeStrategy: 'bump',
};
exports.supportedDatasources = [crate_1.CrateDatasource.id];
//# sourceMappingURL=index.js.map