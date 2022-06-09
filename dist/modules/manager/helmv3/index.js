"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportedDatasources = exports.defaultConfig = exports.supportsLockFileMaintenance = exports.bumpPackageVersion = exports.extractPackageFile = exports.updateArtifacts = void 0;
const docker_1 = require("../../datasource/docker");
const helm_1 = require("../../datasource/helm");
var artifacts_1 = require("./artifacts");
Object.defineProperty(exports, "updateArtifacts", { enumerable: true, get: function () { return artifacts_1.updateArtifacts; } });
var extract_1 = require("./extract");
Object.defineProperty(exports, "extractPackageFile", { enumerable: true, get: function () { return extract_1.extractPackageFile; } });
var update_1 = require("./update");
Object.defineProperty(exports, "bumpPackageVersion", { enumerable: true, get: function () { return update_1.bumpPackageVersion; } });
exports.supportsLockFileMaintenance = true;
exports.defaultConfig = {
    aliases: {
        stable: 'https://charts.helm.sh/stable',
    },
    commitMessageTopic: 'helm chart {{depName}}',
    fileMatch: ['(^|/)Chart.yaml$'],
};
exports.supportedDatasources = [docker_1.DockerDatasource.id, helm_1.HelmDatasource.id];
//# sourceMappingURL=index.js.map