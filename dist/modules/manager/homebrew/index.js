"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportedDatasources = exports.defaultConfig = exports.updateDependency = exports.extractPackageFile = void 0;
const github_tags_1 = require("../../datasource/github-tags");
var extract_1 = require("./extract");
Object.defineProperty(exports, "extractPackageFile", { enumerable: true, get: function () { return extract_1.extractPackageFile; } });
var update_1 = require("./update");
Object.defineProperty(exports, "updateDependency", { enumerable: true, get: function () { return update_1.updateDependency; } });
exports.defaultConfig = {
    commitMessageTopic: 'Homebrew Formula {{depName}}',
    fileMatch: ['^Formula/[^/]+[.]rb$'],
};
exports.supportedDatasources = [github_tags_1.GithubTagsDatasource.id];
//# sourceMappingURL=index.js.map