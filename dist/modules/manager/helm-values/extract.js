"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPackageFile = void 0;
const js_yaml_1 = require("js-yaml");
const logger_1 = require("../../../logger");
const docker_1 = require("../../versioning/docker");
const extract_1 = require("../dockerfile/extract");
const util_1 = require("./util");
function getHelmDep({ registry, repository, tag, }) {
    const dep = (0, extract_1.getDep)(`${registry}${repository}:${tag}`, false);
    dep.replaceString = tag;
    dep.versioning = docker_1.id;
    dep.autoReplaceStringTemplate =
        '{{newValue}}{{#if newDigest}}@{{newDigest}}{{/if}}';
    return dep;
}
/**
 * Recursively find all supported dependencies in the yaml object.
 *
 * @param parsedContent
 */
function findDependencies(parsedContent, packageDependencies) {
    if (!parsedContent || typeof parsedContent !== 'object') {
        return packageDependencies;
    }
    Object.entries(parsedContent).forEach(([key, value]) => {
        if ((0, util_1.matchesHelmValuesDockerHeuristic)(key, value)) {
            const currentItem = value;
            let registry = currentItem.registry;
            registry = registry ? `${registry}/` : '';
            const repository = String(currentItem.repository);
            const tag = String(currentItem.tag);
            packageDependencies.push(getHelmDep({ repository, tag, registry }));
        }
        else if ((0, util_1.matchesHelmValuesInlineImage)(key, value)) {
            packageDependencies.push((0, extract_1.getDep)(value));
        }
        else {
            findDependencies(value, packageDependencies);
        }
    });
    return packageDependencies;
}
function extractPackageFile(content) {
    let parsedContent;
    try {
        // a parser that allows extracting line numbers would be preferable, with
        // the current approach we need to match anything we find again during the update
        // TODO: fix me (#9610)
        parsedContent = (0, js_yaml_1.load)(content, { json: true });
    }
    catch (err) {
        logger_1.logger.debug({ err }, 'Failed to parse helm-values YAML');
        return null;
    }
    try {
        const deps = findDependencies(parsedContent, []);
        if (deps.length) {
            return { deps };
        }
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.warn({ err }, 'Error parsing helm-values parsed content');
    }
    return null;
}
exports.extractPackageFile = extractPackageFile;
//# sourceMappingURL=extract.js.map