"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportedDatasources = exports.defaultConfig = exports.extractPackageFile = void 0;
const docker_1 = require("../../datasource/docker");
const helm_1 = require("../../datasource/helm");
var extract_1 = require("./extract");
Object.defineProperty(exports, "extractPackageFile", { enumerable: true, get: function () { return extract_1.extractPackageFile; } });
exports.defaultConfig = {
    aliases: {
        stable: 'https://charts.helm.sh/stable',
    },
    commitMessageTopic: 'helm chart {{depName}}',
    fileMatch: ['(^|/)helmfile.yaml$'],
};
exports.supportedDatasources = [helm_1.HelmDatasource.id, docker_1.DockerDatasource.id];
//# sourceMappingURL=index.js.map