"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPackageFile = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const js_yaml_1 = require("js-yaml");
const git_tags_1 = require("../../datasource/git-tags");
const helm_1 = require("../../datasource/helm");
const util_1 = require("./util");
function createDependency(definition) {
    let source;
    switch (definition.kind) {
        case 'Application':
            source = definition?.spec?.source;
            break;
        case 'ApplicationSet':
            source = definition?.spec?.template?.spec?.source;
            break;
    }
    if (!source ||
        !is_1.default.nonEmptyString(source.repoURL) ||
        !is_1.default.nonEmptyString(source.targetRevision)) {
        return null;
    }
    // a chart variable is defined this is helm declaration
    if (source.chart) {
        return {
            depName: source.chart,
            registryUrls: [source.repoURL],
            currentValue: source.targetRevision,
            datasource: helm_1.HelmDatasource.id,
        };
    }
    return {
        depName: source.repoURL,
        currentValue: source.targetRevision,
        datasource: git_tags_1.GitTagsDatasource.id,
    };
}
function extractPackageFile(content, _fileName, _config) {
    // check for argo reference. API version for the kind attribute is used
    if (util_1.fileTestRegex.test(content) === false) {
        return null;
    }
    const definitions = (0, js_yaml_1.loadAll)(content);
    const deps = definitions
        .map((definition) => createDependency(definition))
        .filter(is_1.default.truthy);
    return deps.length ? { deps } : null;
}
exports.extractPackageFile = extractPackageFile;
//# sourceMappingURL=extract.js.map