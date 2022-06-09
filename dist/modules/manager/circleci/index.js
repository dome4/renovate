"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportedDatasources = exports.defaultConfig = exports.extractPackageFile = void 0;
const docker_1 = require("../../datasource/docker");
const orb_1 = require("../../datasource/orb");
const extract_1 = require("./extract");
Object.defineProperty(exports, "extractPackageFile", { enumerable: true, get: function () { return extract_1.extractPackageFile; } });
exports.defaultConfig = {
    fileMatch: ['(^|/).circleci/config.yml$'],
};
exports.supportedDatasources = [docker_1.DockerDatasource.id, orb_1.OrbDatasource.id];
//# sourceMappingURL=index.js.map