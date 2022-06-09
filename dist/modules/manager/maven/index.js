"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportedDatasources = exports.defaultConfig = exports.language = exports.updateDependency = exports.bumpPackageVersion = exports.extractAllPackageFiles = void 0;
const tslib_1 = require("tslib");
const constants_1 = require("../../../constants");
const maven_1 = require("../../datasource/maven");
const mavenVersioning = tslib_1.__importStar(require("../../versioning/maven"));
var extract_1 = require("./extract");
Object.defineProperty(exports, "extractAllPackageFiles", { enumerable: true, get: function () { return extract_1.extractAllPackageFiles; } });
var update_1 = require("./update");
Object.defineProperty(exports, "bumpPackageVersion", { enumerable: true, get: function () { return update_1.bumpPackageVersion; } });
Object.defineProperty(exports, "updateDependency", { enumerable: true, get: function () { return update_1.updateDependency; } });
exports.language = constants_1.ProgrammingLanguage.Java;
exports.defaultConfig = {
    fileMatch: ['(^|/|\\.)pom\\.xml$', '^(((\\.mvn)|(\\.m2))/)?settings\\.xml$'],
    versioning: mavenVersioning.id,
};
exports.supportedDatasources = [maven_1.MavenDatasource.id];
//# sourceMappingURL=index.js.map