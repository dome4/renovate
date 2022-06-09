"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVars = exports.reorderFiles = exports.toAbsolutePath = exports.isTOMLFile = exports.isPropsFile = exports.isGradleBuildFile = exports.isGradleVersionsFile = exports.interpolateString = exports.parseDependencyString = exports.isDependencyString = exports.versionLikeSubstring = void 0;
const tslib_1 = require("tslib");
const upath_1 = tslib_1.__importDefault(require("upath"));
const regex_1 = require("../../../util/regex");
const common_1 = require("./common");
const artifactRegex = (0, regex_1.regEx)('^[a-zA-Z][-_a-zA-Z0-9]*(?:\\.[a-zA-Z0-9][-_a-zA-Z0-9]*?)*$');
const versionLikeRegex = (0, regex_1.regEx)('^(?<version>[-.\\[\\](),a-zA-Z0-9+]+)');
// Extracts version-like and range-like strings
// from the beginning of input
function versionLikeSubstring(input) {
    const match = input ? versionLikeRegex.exec(input) : null;
    return match?.groups?.version ?? null;
}
exports.versionLikeSubstring = versionLikeSubstring;
function isDependencyString(input) {
    const split = input?.split(':');
    if (split?.length !== 3) {
        return false;
    }
    // eslint-disable-next-line prefer-const
    let [tempGroupId, tempArtifactId, tempVersionPart] = split;
    if (tempVersionPart !== versionLikeSubstring(tempVersionPart) &&
        tempVersionPart.includes('@')) {
        const versionSplit = tempVersionPart?.split('@');
        if (versionSplit?.length !== 2) {
            return false;
        }
        [tempVersionPart] = versionSplit;
    }
    const [groupId, artifactId, versionPart] = [
        tempGroupId,
        tempArtifactId,
        tempVersionPart,
    ];
    return !!(groupId &&
        artifactId &&
        versionPart &&
        artifactRegex.test(groupId) &&
        artifactRegex.test(artifactId) &&
        versionPart === versionLikeSubstring(versionPart));
}
exports.isDependencyString = isDependencyString;
function parseDependencyString(input) {
    if (!isDependencyString(input)) {
        return null;
    }
    const [groupId, artifactId, FullValue] = input.split(':');
    if (FullValue === versionLikeSubstring(FullValue)) {
        return {
            depName: `${groupId}:${artifactId}`,
            currentValue: FullValue,
        };
    }
    const [currentValue, dataType] = FullValue.split('@');
    return {
        depName: `${groupId}:${artifactId}`,
        currentValue,
        dataType,
    };
}
exports.parseDependencyString = parseDependencyString;
function interpolateString(childTokens, variables) {
    const resolvedSubstrings = [];
    for (const childToken of childTokens) {
        const type = childToken.type;
        if (type === common_1.TokenType.String) {
            resolvedSubstrings.push(childToken.value);
        }
        else if (type === common_1.TokenType.Variable) {
            const varName = childToken.value;
            const varData = variables[varName];
            if (varData) {
                resolvedSubstrings.push(varData.value);
            }
            else {
                return null;
            }
        }
        else {
            return null;
        }
    }
    return resolvedSubstrings.join('');
}
exports.interpolateString = interpolateString;
const gradleVersionsFileRegex = (0, regex_1.regEx)('^versions\\.gradle(?:\\.kts)?$', 'i');
const gradleBuildFileRegex = (0, regex_1.regEx)('^build\\.gradle(?:\\.kts)?$', 'i');
function isGradleVersionsFile(path) {
    const filename = upath_1.default.basename(path);
    return gradleVersionsFileRegex.test(filename);
}
exports.isGradleVersionsFile = isGradleVersionsFile;
function isGradleBuildFile(path) {
    const filename = upath_1.default.basename(path);
    return gradleBuildFileRegex.test(filename);
}
exports.isGradleBuildFile = isGradleBuildFile;
function isPropsFile(path) {
    const filename = upath_1.default.basename(path).toLowerCase();
    return filename === 'gradle.properties';
}
exports.isPropsFile = isPropsFile;
function isTOMLFile(path) {
    const filename = upath_1.default.basename(path).toLowerCase();
    return filename.endsWith('.toml');
}
exports.isTOMLFile = isTOMLFile;
function toAbsolutePath(packageFile) {
    return upath_1.default.join(packageFile.replace((0, regex_1.regEx)(/^[/\\]*/), '/'));
}
exports.toAbsolutePath = toAbsolutePath;
function getFileRank(filename) {
    if (isPropsFile(filename)) {
        return 0;
    }
    if (isGradleVersionsFile(filename)) {
        return 1;
    }
    if (isGradleBuildFile(filename)) {
        return 3;
    }
    return 2;
}
function reorderFiles(packageFiles) {
    return packageFiles.sort((x, y) => {
        const xAbs = toAbsolutePath(x);
        const yAbs = toAbsolutePath(y);
        const xDir = upath_1.default.dirname(xAbs);
        const yDir = upath_1.default.dirname(yAbs);
        if (xDir === yDir) {
            const xRank = getFileRank(xAbs);
            const yRank = getFileRank(yAbs);
            if (xRank === yRank) {
                if (xAbs > yAbs) {
                    return 1;
                }
                if (xAbs < yAbs) {
                    return -1;
                }
            }
            else if (xRank > yRank) {
                return 1;
            }
            else if (yRank > xRank) {
                return -1;
            }
        }
        else if (xDir.startsWith(yDir)) {
            return 1;
        }
        else if (yDir.startsWith(xDir)) {
            return -1;
        }
        return 0;
    });
}
exports.reorderFiles = reorderFiles;
function getVars(registry, dir, vars = registry[dir] || {}) {
    const dirAbs = toAbsolutePath(dir);
    const parentDir = upath_1.default.dirname(dirAbs);
    if (parentDir === dirAbs) {
        return vars;
    }
    const parentVars = registry[parentDir] || {};
    return getVars(registry, parentDir, { ...parentVars, ...vars });
}
exports.getVars = getVars;
//# sourceMappingURL=utils.js.map