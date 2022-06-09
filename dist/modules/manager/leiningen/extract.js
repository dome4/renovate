"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPackageFile = exports.extractVariables = exports.extractFromVectors = exports.expandDepName = exports.trimAtKey = void 0;
const regex_1 = require("../../../util/regex");
const clojure_1 = require("../../datasource/clojure");
function trimAtKey(str, kwName) {
    const regex = new RegExp(`:${kwName}(?=\\s)`); // TODO #12872 lookahead
    const keyOffset = str.search(regex);
    if (keyOffset < 0) {
        return null;
    }
    const withSpaces = str.slice(keyOffset + kwName.length + 1);
    const valueOffset = withSpaces.search((0, regex_1.regEx)(/[^\s]/));
    if (valueOffset < 0) {
        return null;
    }
    return withSpaces.slice(valueOffset);
}
exports.trimAtKey = trimAtKey;
function expandDepName(name) {
    return name.includes('/') ? name.replace('/', ':') : `${name}:${name}`;
}
exports.expandDepName = expandDepName;
function extractFromVectors(str, ctx = {}, vars = {}) {
    if (!str.startsWith('[')) {
        return [];
    }
    let balance = 0;
    const result = [];
    let idx = 0;
    let vecPos = 0;
    let artifactId = '';
    let version = '';
    const isSpace = (ch) => !!ch && (0, regex_1.regEx)(/[\s,]/).test(ch);
    const cleanStrLiteral = (s) => s.replace((0, regex_1.regEx)(/^"/), '').replace((0, regex_1.regEx)(/"$/), '');
    const yieldDep = () => {
        if (artifactId && version) {
            const depName = expandDepName(cleanStrLiteral(artifactId));
            if (version.startsWith('~')) {
                const varName = version.replace((0, regex_1.regEx)(/^~\s*/), '');
                const currentValue = vars[varName];
                if (currentValue) {
                    result.push({
                        ...ctx,
                        datasource: clojure_1.ClojureDatasource.id,
                        depName,
                        currentValue,
                        groupName: varName,
                    });
                }
            }
            else {
                result.push({
                    ...ctx,
                    datasource: clojure_1.ClojureDatasource.id,
                    depName,
                    currentValue: cleanStrLiteral(version),
                });
            }
        }
        artifactId = '';
        version = '';
    };
    let prevChar = null;
    while (idx < str.length) {
        const char = str.charAt(idx);
        if (char === '[') {
            balance += 1;
            if (balance === 2) {
                vecPos = 0;
            }
        }
        else if (char === ']') {
            balance -= 1;
            if (balance === 1) {
                yieldDep();
            }
            else if (balance === 0) {
                break;
            }
        }
        else if (balance === 2) {
            if (isSpace(char)) {
                if (!isSpace(prevChar)) {
                    vecPos += 1;
                }
            }
            else if (vecPos === 0) {
                artifactId += char;
            }
            else if (vecPos === 1) {
                version += char;
            }
        }
        prevChar = char;
        idx += 1;
    }
    return result;
}
exports.extractFromVectors = extractFromVectors;
function extractLeinRepos(content) {
    const result = [];
    const repoContent = trimAtKey(content.replace(/;;.*(?=[\r\n])/g, ''), // get rid of comments // TODO #12872 lookahead
    'repositories');
    if (repoContent) {
        let balance = 0;
        let endIdx = 0;
        for (let idx = 0; idx < repoContent.length; idx += 1) {
            const char = repoContent.charAt(idx);
            if (char === '[') {
                balance += 1;
            }
            else if (char === ']') {
                balance -= 1;
                if (balance <= 0) {
                    endIdx = idx;
                    break;
                }
            }
        }
        const repoSectionContent = repoContent.slice(0, endIdx);
        const matches = repoSectionContent.match((0, regex_1.regEx)(/"https?:\/\/[^"]*"/g)) || [];
        const urls = matches.map((x) => x.replace((0, regex_1.regEx)(/^"/), '').replace((0, regex_1.regEx)(/"$/), ''));
        urls.forEach((url) => result.push(url));
    }
    return result;
}
const defRegex = (0, regex_1.regEx)(/^[\s,]*\([\s,]*def[\s,]+(?<varName>[-+*=<>.!?#$%&_|a-zA-Z][-+*=<>.!?#$%&_|a-zA-Z0-9']+)[\s,]*"(?<stringValue>[^"]*)"[\s,]*\)[\s,]*$/);
function extractVariables(content) {
    const result = {};
    const lines = content.split(regex_1.newlineRegex);
    for (let idx = 0; idx < lines.length; idx += 1) {
        const line = lines[idx];
        const match = defRegex.exec(line);
        if (match?.groups) {
            const { varName: key, stringValue: val } = match.groups;
            result[key] = val;
        }
    }
    return result;
}
exports.extractVariables = extractVariables;
function collectDeps(content, key, registryUrls, vars) {
    const ctx = {
        depType: key,
        registryUrls,
    };
    let result = [];
    let restContent = trimAtKey(content, key);
    while (restContent) {
        result = [...result, ...extractFromVectors(restContent, ctx, vars)];
        restContent = trimAtKey(restContent, key);
    }
    return result;
}
function extractPackageFile(content) {
    const registryUrls = extractLeinRepos(content);
    const vars = extractVariables(content);
    const deps = [
        ...collectDeps(content, 'dependencies', registryUrls, vars),
        ...collectDeps(content, 'managed-dependencies', registryUrls, vars),
        ...collectDeps(content, 'plugins', registryUrls, vars),
        ...collectDeps(content, 'pom-plugins', registryUrls, vars),
    ];
    return { deps };
}
exports.extractPackageFile = extractPackageFile;
//# sourceMappingURL=extract.js.map