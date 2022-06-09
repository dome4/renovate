"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportedDatasources = exports.defaultConfig = exports.language = exports.extractPackageFile = exports.extractAllPackageFiles = void 0;
const constants_1 = require("../../../constants");
const docker_1 = require("../../datasource/docker");
const extract_1 = require("./extract");
Object.defineProperty(exports, "extractAllPackageFiles", { enumerable: true, get: function () { return extract_1.extractAllPackageFiles; } });
Object.defineProperty(exports, "extractPackageFile", { enumerable: true, get: function () { return extract_1.extractPackageFile; } });
const language = constants_1.ProgrammingLanguage.Docker;
exports.language = language;
exports.defaultConfig = {
    fileMatch: ['\\.gitlab-ci\\.yml$'],
};
exports.supportedDatasources = [docker_1.DockerDatasource.id];
//# sourceMappingURL=index.js.map