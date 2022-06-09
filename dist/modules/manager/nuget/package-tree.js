"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDependentPackageFiles = exports.MSBUILD_CENTRAL_FILE = exports.NUGET_CENTRAL_FILE = void 0;
const tslib_1 = require("tslib");
const graph_data_structure_1 = tslib_1.__importDefault(require("graph-data-structure"));
const minimatch_1 = tslib_1.__importDefault(require("minimatch"));
const upath_1 = tslib_1.__importDefault(require("upath"));
const xmldoc_1 = tslib_1.__importDefault(require("xmldoc"));
const logger_1 = require("../../../logger");
const fs_1 = require("../../../util/fs");
const git_1 = require("../../../util/git");
exports.NUGET_CENTRAL_FILE = 'Directory.Packages.props';
exports.MSBUILD_CENTRAL_FILE = 'Packages.props';
/**
 * Get all package files at any level of ancestry that depend on packageFileName
 */
async function getDependentPackageFiles(packageFileName, isCentralManament = false) {
    const packageFiles = await getAllPackageFiles();
    const graph = (0, graph_data_structure_1.default)();
    if (isCentralManament) {
        graph.addNode(packageFileName);
    }
    const parentDir = packageFileName === exports.NUGET_CENTRAL_FILE ||
        packageFileName === exports.MSBUILD_CENTRAL_FILE
        ? ''
        : upath_1.default.dirname(packageFileName);
    for (const f of packageFiles) {
        graph.addNode(f);
        if (isCentralManament && upath_1.default.dirname(f).startsWith(parentDir)) {
            graph.addEdge(packageFileName, f);
        }
    }
    for (const f of packageFiles) {
        const packageFileContent = await (0, fs_1.readLocalFile)(f, 'utf8');
        const doc = new xmldoc_1.default.XmlDocument(packageFileContent);
        const projectReferenceAttributes = doc
            .childrenNamed('ItemGroup')
            .map((ig) => ig.childrenNamed('ProjectReference'))
            .flat()
            .map((pf) => pf.attr['Include']);
        const projectReferences = projectReferenceAttributes.map((a) => upath_1.default.normalize(a));
        const normalizedRelativeProjectReferences = projectReferences.map((r) => reframeRelativePathToRootOfRepo(f, r));
        for (const ref of normalizedRelativeProjectReferences) {
            graph.addEdge(ref, f);
        }
        if (graph.hasCycle()) {
            throw new Error('Circular reference detected in NuGet package files');
        }
    }
    const dependents = recursivelyGetDependentPackageFiles(packageFileName, graph);
    // deduplicate
    return Array.from(new Set(dependents.reverse())).reverse();
}
exports.getDependentPackageFiles = getDependentPackageFiles;
/**
 * Traverse graph and find dependent package files at any level of ancestry
 */
function recursivelyGetDependentPackageFiles(packageFileName, graph) {
    const dependents = graph.adjacent(packageFileName);
    if (dependents.length === 0) {
        return [];
    }
    return dependents.concat(dependents.map((d) => recursivelyGetDependentPackageFiles(d, graph)).flat());
}
/**
 * Take the path relative from a project file, and make it relative from the root of the repo
 */
function reframeRelativePathToRootOfRepo(dependentProjectRelativePath, projectReference) {
    const virtualRepoRoot = '/';
    const absoluteDependentProjectPath = upath_1.default.resolve(virtualRepoRoot, dependentProjectRelativePath);
    const absoluteProjectReferencePath = upath_1.default.resolve(upath_1.default.dirname(absoluteDependentProjectPath), projectReference);
    const relativeProjectReferencePath = upath_1.default.relative(virtualRepoRoot, absoluteProjectReferencePath);
    return relativeProjectReferencePath;
}
/**
 * Get a list of package files in localDir
 */
async function getAllPackageFiles() {
    const allFiles = await (0, git_1.getFileList)();
    const filteredPackageFiles = allFiles.filter(minimatch_1.default.filter('*.{cs,vb,fs}proj', { matchBase: true, nocase: true }));
    logger_1.logger.trace({ filteredPackageFiles }, 'Found package files');
    return filteredPackageFiles;
}
//# sourceMappingURL=package-tree.js.map