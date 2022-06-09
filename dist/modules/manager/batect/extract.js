"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractAllPackageFiles = exports.extractPackageFile = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const js_yaml_1 = require("js-yaml");
const upath_1 = tslib_1.__importDefault(require("upath"));
const logger_1 = require("../../../logger");
const fs_1 = require("../../../util/fs");
const git_tags_1 = require("../../datasource/git-tags");
const docker_1 = require("../../versioning/docker");
const semver_1 = require("../../versioning/semver");
const extract_1 = require("../dockerfile/extract");
function loadConfig(content) {
    const config = (0, js_yaml_1.load)(content);
    if (typeof config !== 'object') {
        throw new Error(`Configuration file does not contain a YAML object (it is ${typeof config}).`);
    }
    return config;
}
function extractImages(config) {
    if (config.containers === undefined) {
        return [];
    }
    return Object.values(config.containers)
        .map((container) => container.image)
        .filter(is_1.default.string);
}
function createImageDependency(tag) {
    return {
        ...(0, extract_1.getDep)(tag),
        versioning: docker_1.id,
    };
}
function extractImageDependencies(config) {
    const images = extractImages(config);
    const deps = images.map((image) => createImageDependency(image));
    logger_1.logger.trace({ deps }, 'Loaded images from Batect configuration file');
    return deps;
}
function includeIsGitInclude(include) {
    return typeof include === 'object' && include.type === 'git';
}
function extractGitBundles(config) {
    if (config.include === undefined) {
        return [];
    }
    return config.include.filter(includeIsGitInclude);
}
function createBundleDependency(bundle) {
    return {
        depName: bundle.repo,
        currentValue: bundle.ref,
        versioning: semver_1.id,
        datasource: git_tags_1.GitTagsDatasource.id,
        commitMessageTopic: 'bundle {{depName}}',
    };
}
function extractBundleDependencies(config) {
    const bundles = extractGitBundles(config);
    const deps = bundles.map((bundle) => createBundleDependency(bundle));
    logger_1.logger.trace({ deps }, 'Loaded bundles from Batect configuration file');
    return deps;
}
function includeIsStringFileInclude(include) {
    return typeof include === 'string';
}
function includeIsObjectFileInclude(include) {
    return typeof include === 'object' && include.type === 'file';
}
function extractReferencedConfigFiles(config, fileName) {
    if (config.include === undefined) {
        return [];
    }
    const dirName = upath_1.default.dirname(fileName);
    const paths = [
        ...config.include.filter(includeIsStringFileInclude),
        ...config.include
            .filter(includeIsObjectFileInclude)
            .map((include) => include.path),
    ].filter((p) => p !== undefined && p !== null);
    return paths.map((p) => upath_1.default.join(dirName, p));
}
function extractPackageFile(content, fileName) {
    logger_1.logger.debug({ fileName }, 'batect.extractPackageFile()');
    try {
        const config = loadConfig(content);
        const deps = [
            ...extractImageDependencies(config),
            ...extractBundleDependencies(config),
        ];
        const referencedConfigFiles = extractReferencedConfigFiles(config, fileName);
        return { deps, referencedConfigFiles };
    }
    catch (err) {
        logger_1.logger.warn({ err, fileName }, 'Extracting dependencies from Batect configuration file failed');
        return null;
    }
}
exports.extractPackageFile = extractPackageFile;
async function extractAllPackageFiles(config, packageFiles) {
    const filesToExamine = new Set(packageFiles);
    const filesAlreadyExamined = new Set();
    const results = [];
    while (filesToExamine.size > 0) {
        const packageFile = filesToExamine.values().next().value;
        filesToExamine.delete(packageFile);
        filesAlreadyExamined.add(packageFile);
        const content = await (0, fs_1.readLocalFile)(packageFile, 'utf8');
        const result = extractPackageFile(content, packageFile);
        if (result !== null) {
            result.referencedConfigFiles.forEach((f) => {
                if (!filesAlreadyExamined.has(f) && !filesToExamine.has(f)) {
                    filesToExamine.add(f);
                }
            });
            results.push({
                packageFile,
                deps: result.deps,
            });
        }
    }
    return results;
}
exports.extractAllPackageFiles = extractAllPackageFiles;
//# sourceMappingURL=extract.js.map