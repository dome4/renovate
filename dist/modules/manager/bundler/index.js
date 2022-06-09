"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportedDatasources = exports.defaultConfig = exports.updateLockedDependency = exports.language = exports.getRangeStrategy = exports.updateArtifacts = exports.extractPackageFile = exports.supportsLockFileMaintenance = void 0;
const tslib_1 = require("tslib");
const constants_1 = require("../../../constants");
const ruby_version_1 = require("../../datasource/ruby-version");
const rubygems_1 = require("../../datasource/rubygems");
const rubyVersioning = tslib_1.__importStar(require("../../versioning/ruby"));
const artifacts_1 = require("./artifacts");
Object.defineProperty(exports, "updateArtifacts", { enumerable: true, get: function () { return artifacts_1.updateArtifacts; } });
const extract_1 = require("./extract");
Object.defineProperty(exports, "extractPackageFile", { enumerable: true, get: function () { return extract_1.extractPackageFile; } });
const range_1 = require("./range");
Object.defineProperty(exports, "getRangeStrategy", { enumerable: true, get: function () { return range_1.getRangeStrategy; } });
const update_locked_1 = require("./update-locked");
Object.defineProperty(exports, "updateLockedDependency", { enumerable: true, get: function () { return update_locked_1.updateLockedDependency; } });
const language = constants_1.ProgrammingLanguage.Ruby;
exports.language = language;
exports.supportsLockFileMaintenance = true;
exports.defaultConfig = {
    fileMatch: ['(^|/)Gemfile$'],
    versioning: rubyVersioning.id,
};
exports.supportedDatasources = [
    rubygems_1.RubyGemsDatasource.id,
    ruby_version_1.RubyVersionDatasource.id,
];
//# sourceMappingURL=index.js.map