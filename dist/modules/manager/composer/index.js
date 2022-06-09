"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportedDatasources = exports.defaultConfig = exports.updateLockedDependency = exports.getRangeStrategy = exports.language = exports.updateArtifacts = exports.extractPackageFile = exports.supportsLockFileMaintenance = void 0;
const constants_1 = require("../../../constants");
const git_tags_1 = require("../../datasource/git-tags");
const packagist_1 = require("../../datasource/packagist");
const artifacts_1 = require("./artifacts");
Object.defineProperty(exports, "updateArtifacts", { enumerable: true, get: function () { return artifacts_1.updateArtifacts; } });
const extract_1 = require("./extract");
Object.defineProperty(exports, "extractPackageFile", { enumerable: true, get: function () { return extract_1.extractPackageFile; } });
const range_1 = require("./range");
Object.defineProperty(exports, "getRangeStrategy", { enumerable: true, get: function () { return range_1.getRangeStrategy; } });
const update_locked_1 = require("./update-locked");
Object.defineProperty(exports, "updateLockedDependency", { enumerable: true, get: function () { return update_locked_1.updateLockedDependency; } });
const utils_1 = require("./utils");
const language = constants_1.ProgrammingLanguage.PHP;
exports.language = language;
exports.supportsLockFileMaintenance = true;
exports.defaultConfig = {
    fileMatch: ['(^|/)([\\w-]*)composer.json$'],
    versioning: utils_1.composerVersioningId,
};
exports.supportedDatasources = [
    git_tags_1.GitTagsDatasource.id,
    packagist_1.PackagistDatasource.id,
];
//# sourceMappingURL=index.js.map