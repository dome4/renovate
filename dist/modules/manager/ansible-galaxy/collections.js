"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractCollections = void 0;
const regex_1 = require("../../../util/regex");
const galaxy_collection_1 = require("../../datasource/galaxy-collection");
const git_tags_1 = require("../../datasource/git-tags");
const github_tags_1 = require("../../datasource/github-tags");
const util_1 = require("./util");
function interpretLine(lineMatch, dependency) {
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
            break;
        }
        case 'source': {
            localDependency.managerData.source = value;
            localDependency.registryUrls = value ? [value] : [];
            break;
        }
        case 'type': {
            localDependency.managerData.type = value;
            break;
        }
        default: {
            // fail if we find an unexpected key
            localDependency.skipReason = 'unsupported';
        }
    }
}
function handleGitDep(dep, nameMatch) {
    dep.datasource = git_tags_1.GitTagsDatasource.id;
    if (nameMatch?.groups) {
        // if a github.com repository is referenced use github-tags instead of git-tags
        if (nameMatch.groups.hostname === 'github.com') {
            dep.datasource = github_tags_1.GithubTagsDatasource.id;
        }
        else {
            dep.datasource = git_tags_1.GitTagsDatasource.id;
        }
        // source definition without version appendix
        const source = nameMatch.groups.source;
        const massagedDepName = nameMatch.groups.depName.replace((0, regex_1.regEx)(/.git$/), '');
        dep.depName = `${nameMatch.groups.hostname}/${massagedDepName}`;
        // remove leading `git+` from URLs like `git+https://...`
        dep.packageName = source.replace((0, regex_1.regEx)(/git\+/), '');
        // if version is declared using version appendix `<source url>,v1.2.0`, use it
        if (nameMatch.groups.version) {
            dep.currentValue = nameMatch.groups.version;
        }
        else {
            dep.currentValue = dep.managerData.version;
        }
    }
}
function handleGalaxyDep(dep) {
    dep.datasource = galaxy_collection_1.GalaxyCollectionDatasource.id;
    dep.depName = dep.managerData.name;
    dep.registryUrls = dep.managerData.source ? [dep.managerData.source] : [];
    dep.currentValue = dep.managerData.version;
}
function finalize(dependency) {
    const dep = dependency;
    dep.depName = dep.managerData.name;
    const name = dep.managerData.name;
    const nameMatch = util_1.nameMatchRegex.exec(name);
    // use type if defined
    switch (dependency.managerData.type) {
        case 'galaxy':
            handleGalaxyDep(dep);
            break;
        case 'git':
            handleGitDep(dep, nameMatch);
            break;
        case 'file':
            dep.skipReason = 'local-dependency';
            break;
        case null:
            // try to find out type based on source
            if (nameMatch) {
                handleGitDep(dep, nameMatch);
                break;
            }
            if (util_1.galaxyDepRegex.exec(dep.managerData.name)) {
                dep.datasource = galaxy_collection_1.GalaxyCollectionDatasource.id;
                dep.depName = dep.managerData.name;
                break;
            }
            dep.skipReason = 'no-source-match';
            break;
        default:
            dep.skipReason = 'unsupported';
            return true;
    }
    if (!dependency.currentValue && !dep.skipReason) {
        dep.skipReason = 'no-version';
    }
    return true;
}
function extractCollections(lines) {
    const deps = [];
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
        let lineMatch = util_1.newBlockRegEx.exec(lines[lineNumber]);
        if (lineMatch) {
            const dep = {
                depType: 'galaxy-collection',
                managerData: {
                    name: null,
                    version: null,
                    type: null,
                    source: null,
                },
            };
            do {
                interpretLine(lineMatch, dep);
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
exports.extractCollections = extractCollections;
//# sourceMappingURL=collections.js.map