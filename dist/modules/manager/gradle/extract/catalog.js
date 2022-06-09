"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCatalog = void 0;
const tslib_1 = require("tslib");
const toml_1 = require("@iarna/toml");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const deepmerge_1 = tslib_1.__importDefault(require("deepmerge"));
const object_1 = require("../../../../util/object");
const regex_1 = require("../../../../util/regex");
function findVersionIndex(content, depName, version) {
    const eDn = (0, regex_1.escapeRegExp)(depName);
    const eVer = (0, regex_1.escapeRegExp)(version);
    const re = (0, regex_1.regEx)(`(?:id\\s*=\\s*)?['"]?${eDn}["']?(?:(?:\\s*=\\s*)|:|,\\s*)(?:.*version(?:\\.ref)?(?:\\s*\\=\\s*))?["']?${eVer}['"]?`);
    const match = re.exec(content);
    if (match) {
        return match.index + content.slice(match.index).indexOf(version);
    }
    // ignoring Fallback because I can't reach it in tests, and code is not supposed to reach it but just in case.
    /* istanbul ignore next */
    return findIndexAfter(content, depName, version);
}
function findIndexAfter(content, sliceAfter, find) {
    const slicePoint = content.indexOf(sliceAfter) + sliceAfter.length;
    return slicePoint + content.slice(slicePoint).indexOf(find);
}
function isArtifactDescriptor(obj) {
    return (0, object_1.hasKey)('group', obj);
}
function isVersionPointer(obj) {
    return (0, object_1.hasKey)('ref', obj);
}
function extractVersion({ version, versions, depStartIndex, depSubContent, depName, versionStartIndex, versionSubContent, }) {
    if (isVersionPointer(version)) {
        // everything else is ignored
        return extractLiteralVersion({
            version: versions[version.ref],
            depStartIndex: versionStartIndex,
            depSubContent: versionSubContent,
            sectionKey: version.ref,
        });
    }
    else {
        return extractLiteralVersion({
            version: version,
            depStartIndex,
            depSubContent,
            sectionKey: depName,
        });
    }
}
function extractLiteralVersion({ version, depStartIndex, depSubContent, sectionKey, }) {
    if (!version) {
        return { skipReason: 'no-version' };
    }
    else if (is_1.default.string(version)) {
        const fileReplacePosition = depStartIndex + findVersionIndex(depSubContent, sectionKey, version);
        return { currentValue: version, fileReplacePosition };
    }
    else if (is_1.default.plainObject(version)) {
        // https://github.com/gradle/gradle/blob/d9adf33a57925582988fc512002dcc0e8ce4db95/subprojects/core/src/main/java/org/gradle/api/internal/catalog/parser/TomlCatalogFileParser.java#L368
        // https://docs.gradle.org/current/userguide/rich_versions.html
        // https://docs.gradle.org/current/userguide/platforms.html#sub::toml-dependencies-format
        const versionKeys = ['require', 'prefer', 'strictly'];
        let found = false;
        let currentValue;
        let fileReplacePosition;
        if (version.reject || version.rejectAll) {
            return { skipReason: 'unsupported-version' };
        }
        for (const key of versionKeys) {
            if (key in version) {
                if (found) {
                    // Currently, we only support one version constraint at a time
                    return { skipReason: 'multiple-constraint-dep' };
                }
                found = true;
                currentValue = version[key];
                fileReplacePosition =
                    depStartIndex +
                        findIndexAfter(depSubContent, sectionKey, currentValue);
            }
        }
        if (found) {
            return { currentValue, fileReplacePosition };
        }
    }
    return { skipReason: 'unknown-version' };
}
function extractDependency({ descriptor, versions, depStartIndex, depSubContent, depName, versionStartIndex, versionSubContent, }) {
    if (is_1.default.string(descriptor)) {
        const [groupName, name, currentValue] = descriptor.split(':');
        if (!currentValue) {
            return {
                depName,
                skipReason: 'no-version',
            };
        }
        return {
            depName: `${groupName}:${name}`,
            groupName,
            currentValue,
            managerData: {
                fileReplacePosition: depStartIndex + findIndexAfter(depSubContent, depName, currentValue),
            },
        };
    }
    const { currentValue, fileReplacePosition, skipReason } = extractVersion({
        version: descriptor.version,
        versions,
        depStartIndex,
        depSubContent,
        depName,
        versionStartIndex,
        versionSubContent,
    });
    if (skipReason) {
        return {
            depName,
            skipReason,
        };
    }
    const versionRef = isVersionPointer(descriptor.version)
        ? descriptor.version.ref
        : null;
    if (isArtifactDescriptor(descriptor)) {
        const { group, name } = descriptor;
        const groupName = is_1.default.nullOrUndefined(versionRef) ? group : versionRef; // usage of common variable should have higher priority than other values
        return {
            depName: `${group}:${name}`,
            groupName,
            currentValue,
            managerData: { fileReplacePosition },
        };
    }
    const [depGroupName, name] = descriptor.module.split(':');
    const groupName = is_1.default.nullOrUndefined(versionRef) ? depGroupName : versionRef;
    const dependency = {
        depName: `${depGroupName}:${name}`,
        groupName,
        currentValue,
        managerData: { fileReplacePosition },
    };
    return dependency;
}
function parseCatalog(packageFile, content) {
    const tomlContent = (0, toml_1.parse)(content);
    const versions = tomlContent.versions || {};
    const libs = tomlContent.libraries || {};
    const libStartIndex = content.indexOf('libraries');
    const libSubContent = content.slice(libStartIndex);
    const versionStartIndex = content.indexOf('versions');
    const versionSubContent = content.slice(versionStartIndex);
    const extractedDeps = [];
    for (const libraryName of Object.keys(libs)) {
        const libDescriptor = libs[libraryName];
        const dependency = extractDependency({
            descriptor: libDescriptor,
            versions,
            depStartIndex: libStartIndex,
            depSubContent: libSubContent,
            depName: libraryName,
            versionStartIndex,
            versionSubContent,
        });
        extractedDeps.push(dependency);
    }
    const plugins = tomlContent.plugins || {};
    const pluginsStartIndex = content.indexOf('[plugins]');
    const pluginsSubContent = content.slice(pluginsStartIndex);
    for (const pluginName of Object.keys(plugins)) {
        const pluginDescriptor = plugins[pluginName];
        const [depName, version] = is_1.default.string(pluginDescriptor)
            ? pluginDescriptor.split(':')
            : [pluginDescriptor.id, pluginDescriptor.version];
        const { currentValue, fileReplacePosition, skipReason } = extractVersion({
            version,
            versions,
            depStartIndex: pluginsStartIndex,
            depSubContent: pluginsSubContent,
            depName,
            versionStartIndex,
            versionSubContent,
        });
        const dependency = {
            depType: 'plugin',
            depName,
            packageName: `${depName}:${depName}.gradle.plugin`,
            registryUrls: ['https://plugins.gradle.org/m2/'],
            currentValue,
            commitMessageTopic: `plugin ${pluginName}`,
            managerData: { fileReplacePosition },
        };
        if (skipReason) {
            dependency.skipReason = skipReason;
        }
        if (isVersionPointer(version) && dependency.commitMessageTopic) {
            dependency.groupName = version.ref;
            delete dependency.commitMessageTopic;
        }
        extractedDeps.push(dependency);
    }
    const deps = extractedDeps.map((dep) => {
        return (0, deepmerge_1.default)(dep, { managerData: { packageFile } });
    });
    return deps;
}
exports.parseCatalog = parseCatalog;
//# sourceMappingURL=catalog.js.map