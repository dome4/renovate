"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPackageFile = void 0;
const logger_1 = require("../../../logger");
const regex_1 = require("../../../util/regex");
const extract_1 = require("../dockerfile/extract");
function extractPackageFile(content) {
    const deps = [];
    try {
        const lines = content.split(regex_1.newlineRegex);
        for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
            const line = lines[lineNumber];
            const firstLineMatch = (0, regex_1.regEx)(/^(?<leading>\s* image:\s*)(?<replaceString>['"](?<currentFrom>[^\s'"]+)\\)$/).exec(line);
            if (firstLineMatch?.groups) {
                let currentFrom = firstLineMatch.groups.currentFrom;
                let replaceString = firstLineMatch.groups.replaceString;
                for (let i = lineNumber + 1; i < lines.length; i += 1) {
                    const internalLine = lines[i];
                    const middleLineMatch = (0, regex_1.regEx)(/^(?<replaceString>\s*(?<currentFrom>[^\s'"]+)\\)$/).exec(internalLine);
                    if (middleLineMatch?.groups) {
                        currentFrom += middleLineMatch.groups.currentFrom;
                        replaceString += '\n' + middleLineMatch.groups.replaceString;
                    }
                    else {
                        const finalLineMatch = (0, regex_1.regEx)(/^(?<replaceString>\s*(?<currentFrom>[^\s'"]+)['"])$/).exec(internalLine);
                        if (finalLineMatch?.groups) {
                            currentFrom += finalLineMatch.groups.currentFrom;
                            replaceString += '\n' + finalLineMatch.groups.replaceString;
                            const dep = (0, extract_1.getDep)(currentFrom);
                            dep.depType = 'docker';
                            dep.replaceString = replaceString;
                            if (dep.autoReplaceStringTemplate) {
                                const d = '@{{newDigest}}';
                                const c = firstLineMatch.groups.leading.length + 1;
                                const nd = `\\\n${' '.repeat(c)}${d}`;
                                const replaced = dep.autoReplaceStringTemplate.replace(d, nd);
                                dep.autoReplaceStringTemplate = `"${replaced}"`;
                            }
                            deps.push(dep);
                        }
                        break;
                    }
                }
            }
            else {
                const match = (0, regex_1.regEx)(/^\s* image:\s*'?"?(?<currentFrom>[^\s'"]+)'?"?\s*$/).exec(line);
                if (match?.groups) {
                    const dep = (0, extract_1.getDep)(match.groups.currentFrom);
                    dep.depType = 'docker';
                    deps.push(dep);
                }
            }
        }
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.warn({ err }, 'Error extracting DroneCI images');
    }
    if (!deps.length) {
        return null;
    }
    return { deps };
}
exports.extractPackageFile = extractPackageFile;
//# sourceMappingURL=extract.js.map