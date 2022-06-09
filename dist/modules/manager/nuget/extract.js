"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPackageFile = void 0;
const xmldoc_1 = require("xmldoc");
const logger_1 = require("../../../logger");
const fs_1 = require("../../../util/fs");
const object_1 = require("../../../util/object");
const regex_1 = require("../../../util/regex");
const nuget_1 = require("../../datasource/nuget");
const global_manifest_1 = require("./extract/global-manifest");
const util_1 = require("./util");
/**
 * https://docs.microsoft.com/en-us/nuget/concepts/package-versioning
 * This article mentions that  Nuget 3.x and later tries to restore the lowest possible version
 * regarding to given version range.
 * 1.3.4 equals [1.3.4,)
 * Due to guarantee that an update of package version will result in its usage by the next restore + build operation,
 * only following constrained versions make sense
 * 1.3.4, [1.3.4], [1.3.4, ], [1.3.4, )
 * The update of the right boundary does not make sense regarding to the lowest version restore rule,
 * so we don't include it in the extracting regexp
 */
const checkVersion = (0, regex_1.regEx)(`^\\s*(?:[[])?(?:(?<currentValue>[^"(,[\\]]+)\\s*(?:,\\s*[)\\]]|])?)\\s*$`);
const elemNames = new Set([
    'PackageReference',
    'PackageVersion',
    'DotNetCliToolReference',
    'GlobalPackageReference',
]);
function isXmlElem(node) {
    return (0, object_1.hasKey)('name', node);
}
function extractDepsFromXml(xmlNode) {
    const results = [];
    const todo = [xmlNode];
    while (todo.length) {
        const child = todo.pop();
        const { name, attr } = child;
        if (elemNames.has(name)) {
            const depName = attr?.Include || attr?.Update;
            const version = attr?.Version ||
                child.valueWithPath('Version') ||
                attr?.VersionOverride ||
                child.valueWithPath('VersionOverride');
            const currentValue = checkVersion
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                ?.exec(version)
                ?.groups?.currentValue?.trim();
            if (depName && currentValue) {
                results.push({
                    datasource: nuget_1.NugetDatasource.id,
                    depType: 'nuget',
                    depName,
                    currentValue,
                });
            }
        }
        else {
            todo.push(...child.children.filter(isXmlElem));
        }
    }
    return results;
}
async function extractPackageFile(content, packageFile, config) {
    logger_1.logger.trace({ packageFile }, 'nuget.extractPackageFile()');
    const registries = await (0, util_1.getConfiguredRegistries)(packageFile);
    const registryUrls = registries
        ? registries.map((registry) => registry.url)
        : undefined;
    if (packageFile.endsWith('dotnet-tools.json')) {
        const deps = [];
        let manifest;
        try {
            manifest = JSON.parse(content);
        }
        catch (err) {
            logger_1.logger.debug({ fileName: packageFile }, 'Invalid JSON');
            return null;
        }
        if (manifest.version !== 1) {
            logger_1.logger.debug({ contents: manifest }, 'Unsupported dotnet tools version');
            return null;
        }
        for (const depName of Object.keys(manifest.tools)) {
            const tool = manifest.tools[depName];
            const currentValue = tool.version;
            const dep = {
                depType: 'nuget',
                depName,
                currentValue,
                datasource: nuget_1.NugetDatasource.id,
            };
            if (registryUrls) {
                dep.registryUrls = registryUrls;
            }
            deps.push(dep);
        }
        return { deps };
    }
    if (packageFile.endsWith('global.json')) {
        return (0, global_manifest_1.extractMsbuildGlobalManifest)(content, packageFile);
    }
    let deps = [];
    try {
        const parsedXml = new xmldoc_1.XmlDocument(content);
        deps = extractDepsFromXml(parsedXml).map((dep) => ({
            ...dep,
            ...(registryUrls && { registryUrls }),
        }));
    }
    catch (err) {
        logger_1.logger.debug({ err }, `Failed to parse ${packageFile}`);
    }
    const res = { deps };
    const lockFileName = (0, fs_1.getSiblingFileName)(packageFile, 'packages.lock.json');
    // istanbul ignore if
    if (await (0, fs_1.localPathExists)(lockFileName)) {
        res.lockFiles = [lockFileName];
    }
    return res;
}
exports.extractPackageFile = extractPackageFile;
//# sourceMappingURL=extract.js.map