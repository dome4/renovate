"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractAllPackageFiles = void 0;
const tslib_1 = require("tslib");
const upath_1 = tslib_1.__importDefault(require("upath"));
const logger_1 = require("../../../logger");
const fs_1 = require("../../../util/fs");
const maven_1 = require("../../datasource/maven");
const catalog_1 = require("./extract/catalog");
const parser_1 = require("./parser");
const utils_1 = require("./utils");
const datasource = maven_1.MavenDatasource.id;
// Enables reverse sorting in generateBranchConfig()
//
// Required for grouped dependencies to be upgraded
// correctly in single branch.
//
// https://github.com/renovatebot/renovate/issues/8224
function elevateFileReplacePositionField(deps) {
    return deps.map((dep) => ({
        ...dep,
        fileReplacePosition: dep?.managerData?.fileReplacePosition,
    }));
}
async function extractAllPackageFiles(config, packageFiles) {
    const extractedDeps = [];
    const registry = {};
    const packageFilesByName = {};
    const registryUrls = [];
    const reorderedFiles = (0, utils_1.reorderFiles)(packageFiles);
    for (const packageFile of reorderedFiles) {
        packageFilesByName[packageFile] = {
            packageFile,
            datasource,
            deps: [],
        };
        try {
            const content = await (0, fs_1.readLocalFile)(packageFile, 'utf8');
            const dir = upath_1.default.dirname((0, utils_1.toAbsolutePath)(packageFile));
            const updateVars = (newVars) => {
                const oldVars = registry[dir] || {};
                registry[dir] = { ...oldVars, ...newVars };
            };
            if ((0, utils_1.isPropsFile)(packageFile)) {
                const { vars, deps } = (0, parser_1.parseProps)(content, packageFile);
                updateVars(vars);
                extractedDeps.push(...deps);
            }
            else if ((0, utils_1.isTOMLFile)(packageFile)) {
                const updatesFromCatalog = (0, catalog_1.parseCatalog)(packageFile, content);
                extractedDeps.push(...updatesFromCatalog);
            }
            else {
                const vars = (0, utils_1.getVars)(registry, dir);
                const { deps, urls, vars: gradleVars, } = (0, parser_1.parseGradle)(content, vars, packageFile);
                urls.forEach((url) => {
                    if (!registryUrls.includes(url)) {
                        registryUrls.push(url);
                    }
                });
                registry[dir] = { ...registry[dir], ...gradleVars };
                updateVars(gradleVars);
                extractedDeps.push(...deps);
            }
        }
        catch (err) {
            logger_1.logger.warn({ err, config, packageFile }, `Failed to process Gradle file: ${packageFile}`);
        }
    }
    if (!extractedDeps.length) {
        return null;
    }
    elevateFileReplacePositionField(extractedDeps).forEach((dep) => {
        const key = dep.managerData?.packageFile;
        // istanbul ignore else
        if (key) {
            const pkgFile = packageFilesByName[key];
            const { deps } = pkgFile;
            deps.push({
                ...dep,
                registryUrls: [
                    ...new Set([
                        ...maven_1.defaultRegistryUrls,
                        ...(dep.registryUrls || []),
                        ...registryUrls,
                    ]),
                ],
            });
            packageFilesByName[key] = pkgFile;
        }
        else {
            logger_1.logger.warn({ dep }, `Failed to process Gradle dependency`);
        }
    });
    const result = Object.values(packageFilesByName);
    return result;
}
exports.extractAllPackageFiles = extractAllPackageFiles;
//# sourceMappingURL=extract.js.map