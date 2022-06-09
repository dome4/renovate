"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPackageFile = exports.parseAzurePipelines = exports.extractContainer = exports.extractRepository = void 0;
const js_yaml_1 = require("js-yaml");
const logger_1 = require("../../../logger");
const git_tags_1 = require("../../datasource/git-tags");
const extract_1 = require("../dockerfile/extract");
function extractRepository(repository) {
    if (repository.type !== 'github') {
        return null;
    }
    if (!repository.ref?.startsWith('refs/tags/')) {
        return null;
    }
    return {
        autoReplaceStringTemplate: 'refs/tags/{{newValue}}',
        currentValue: repository.ref.replace('refs/tags/', ''),
        datasource: git_tags_1.GitTagsDatasource.id,
        depName: repository.name,
        depType: 'gitTags',
        packageName: `https://github.com/${repository.name}.git`,
        replaceString: repository.ref,
    };
}
exports.extractRepository = extractRepository;
function extractContainer(container) {
    if (!container.image) {
        return null;
    }
    const dep = (0, extract_1.getDep)(container.image);
    logger_1.logger.debug({
        depName: dep.depName,
        currentValue: dep.currentValue,
        currentDigest: dep.currentDigest,
    }, 'Azure pipelines docker image');
    dep.depType = 'docker';
    return dep;
}
exports.extractContainer = extractContainer;
function parseAzurePipelines(content, filename) {
    let pkg = null;
    try {
        pkg = (0, js_yaml_1.load)(content, { json: true });
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.info({ filename, err }, 'Error parsing azure-pipelines content');
        return null;
    }
    if (!pkg || !pkg.resources) {
        return null;
    }
    pkg.resources.containers = pkg.resources.containers || [];
    pkg.resources.repositories = pkg.resources.repositories || [];
    return pkg;
}
exports.parseAzurePipelines = parseAzurePipelines;
function extractPackageFile(content, filename) {
    logger_1.logger.trace(`azurePipelines.extractPackageFile(${filename})`);
    const deps = [];
    const pkg = parseAzurePipelines(content, filename);
    if (!pkg) {
        return null;
    }
    // grab the repositories tags
    for (const repository of pkg.resources.repositories) {
        const dep = extractRepository(repository);
        if (dep) {
            deps.push(dep);
        }
    }
    // grab the containers tags
    for (const container of pkg.resources.containers) {
        const dep = extractContainer(container);
        if (dep) {
            deps.push(dep);
        }
    }
    if (!deps.length) {
        return null;
    }
    return { deps };
}
exports.extractPackageFile = extractPackageFile;
//# sourceMappingURL=extract.js.map