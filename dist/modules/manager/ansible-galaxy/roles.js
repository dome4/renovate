"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractRoles = void 0;
const regex_1 = require("../../../util/regex");
const galaxy_1 = require("../../datasource/galaxy");
const git_tags_1 = require("../../datasource/git-tags");
const util_1 = require("./util");
function interpretLine(lineMatch, lineNumber, dependency) {
    const localDependency = dependency;
    const key = lineMatch[2];
    const value = lineMatch[3].replace((0, regex_1.regEx)(/["']/g), '');
    switch (key) {
        case 'name': {
            localDependency.managerData.name = value;
            break;
        }
        case 'version': {
            localDependency.managerData.version = value;
            localDependency.currentValue = value;
            localDependency.managerData.lineNumber = lineNumber;
            break;
        }
        case 'scm': {
            localDependency.managerData.scm = value;
            break;
        }
        case 'src': {
            localDependency.managerData.src = value;
            break;
        }
        default: {
            return null;
        }
    }
    return localDependency;
}
function finalize(dependency) {
    const dep = dependency;
    if (dependency.managerData.version === null) {
        dep.skipReason = 'no-version';
        return false;
    }
    const source = dep.managerData.src ?? '';
    const sourceMatch = util_1.nameMatchRegex.exec(source);
    if (sourceMatch?.groups) {
        dep.datasource = git_tags_1.GitTagsDatasource.id;
        dep.depName = sourceMatch.groups.depName.replace((0, regex_1.regEx)(/.git$/), '');
        // remove leading `git+` from URLs like `git+https://...`
        dep.packageName = source.replace((0, regex_1.regEx)(/git\+/), '');
    }
    else if (util_1.galaxyDepRegex.exec(source)) {
        dep.datasource = galaxy_1.GalaxyDatasource.id;
        dep.depName = source;
        dep.packageName = source;
    }
    else if (util_1.galaxyDepRegex.exec(dep.managerData.name ?? '')) {
        dep.datasource = galaxy_1.GalaxyDatasource.id;
        dep.depName = dep.managerData.name;
        dep.packageName = dep.managerData.name;
    }
    else {
        dep.skipReason = 'no-source-match';
        return false;
    }
    if (dep.managerData.name !== null) {
        dep.depName = dep.managerData.name;
    }
    return true;
}
function extractRoles(lines) {
    const deps = [];
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
        let lineMatch = util_1.newBlockRegEx.exec(lines[lineNumber]);
        if (lineMatch) {
            const dep = {
                depType: 'role',
                managerData: {
                    name: null,
                    version: null,
                    scm: null,
                    src: null,
                },
            };
            do {
                const localdep = interpretLine(lineMatch, lineNumber, dep);
                if (!localdep) {
                    break;
                }
                const line = lines[lineNumber + 1];
                if (!line) {
                    break;
                }
                lineMatch = util_1.blockLineRegEx.exec(line);
                if (lineMatch) {
                    lineNumber += 1;
                }
            } while (lineMatch);
            if (finalize(dep)) {
                delete dep.managerData;
                deps.push(dep);
            }
        }
    }
    return deps;
}
exports.extractRoles = extractRoles;
//# sourceMappingURL=roles.js.map