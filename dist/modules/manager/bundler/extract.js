"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPackageFile = void 0;
const logger_1 = require("../../../logger");
const fs_1 = require("../../../util/fs");
const regex_1 = require("../../../util/regex");
const ruby_version_1 = require("../../datasource/ruby-version");
const rubygems_1 = require("../../datasource/rubygems");
const common_1 = require("./common");
const locked_version_1 = require("./locked-version");
function formatContent(input) {
    return input.replace((0, regex_1.regEx)(/^ {2}/), '') + '\n'; //remove leading witespace and add a new line at the end
}
async function extractPackageFile(content, fileName) {
    const res = {
        registryUrls: [],
        deps: [],
    };
    const lines = content.split(regex_1.newlineRegex);
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
        const line = lines[lineNumber];
        let sourceMatch = null;
        for (const delimiter of common_1.delimiters) {
            sourceMatch =
                sourceMatch ||
                    (0, regex_1.regEx)(`^source ${delimiter}([^${delimiter}]+)${delimiter}\\s*$`).exec(line);
        }
        if (sourceMatch) {
            res.registryUrls?.push(sourceMatch[1]);
        }
        const rubyMatch = (0, common_1.extractRubyVersion)(line);
        if (rubyMatch) {
            res.deps.push({
                depName: 'ruby',
                currentValue: rubyMatch,
                datasource: ruby_version_1.RubyVersionDatasource.id,
                registryUrls: null,
            });
        }
        const gemMatchRegex = (0, regex_1.regEx)(`^\\s*gem\\s+(['"])(?<depName>[^'"]+)(['"])(\\s*,\\s*(?<currentValue>(['"])[^'"]+['"](\\s*,\\s*['"][^'"]+['"])?))?`);
        const gemMatch = gemMatchRegex.exec(line);
        if (gemMatch) {
            const dep = {
                depName: gemMatch.groups?.depName,
                managerData: { lineNumber },
            };
            if (gemMatch.groups?.currentValue) {
                const currentValue = gemMatch.groups.currentValue;
                dep.currentValue = (0, regex_1.regEx)(/\s*,\s*/).test(currentValue)
                    ? currentValue
                    : currentValue.slice(1, -1);
            }
            dep.datasource = rubygems_1.RubyGemsDatasource.id;
            res.deps.push(dep);
        }
        const groupMatch = (0, regex_1.regEx)(/^group\s+(.*?)\s+do/).exec(line);
        if (groupMatch) {
            const depTypes = groupMatch[1]
                .split(',')
                .map((group) => group.trim())
                .map((group) => group.replace((0, regex_1.regEx)(/^:/), ''));
            const groupLineNumber = lineNumber;
            let groupContent = '';
            let groupLine = '';
            while (lineNumber < lines.length && groupLine !== 'end') {
                lineNumber += 1;
                groupLine = lines[lineNumber];
                if (groupLine !== 'end') {
                    groupContent += formatContent(groupLine || '');
                }
            }
            const groupRes = await extractPackageFile(groupContent);
            if (groupRes) {
                res.deps = res.deps.concat(groupRes.deps.map((dep) => ({
                    ...dep,
                    depTypes,
                    managerData: {
                        lineNumber: Number(dep.managerData?.lineNumber) + groupLineNumber + 1,
                    },
                })));
            }
        }
        for (const delimiter of common_1.delimiters) {
            const sourceBlockMatch = (0, regex_1.regEx)(`^source\\s+${delimiter}(.*?)${delimiter}\\s+do`).exec(line);
            if (sourceBlockMatch) {
                const repositoryUrl = sourceBlockMatch[1];
                const sourceLineNumber = lineNumber;
                let sourceContent = '';
                let sourceLine = '';
                while (lineNumber < lines.length && sourceLine.trim() !== 'end') {
                    lineNumber += 1;
                    sourceLine = lines[lineNumber];
                    // istanbul ignore if
                    if (sourceLine === null || sourceLine === undefined) {
                        logger_1.logger.info({ content, fileName }, 'Undefined sourceLine');
                        sourceLine = 'end';
                    }
                    if (sourceLine !== 'end') {
                        sourceContent += formatContent(sourceLine);
                    }
                }
                const sourceRes = await extractPackageFile(sourceContent);
                if (sourceRes) {
                    res.deps = res.deps.concat(sourceRes.deps.map((dep) => ({
                        ...dep,
                        registryUrls: [repositoryUrl],
                        managerData: {
                            lineNumber: Number(dep.managerData?.lineNumber) + sourceLineNumber + 1,
                        },
                    })));
                }
            }
        }
        const platformsMatch = (0, regex_1.regEx)(/^platforms\s+(.*?)\s+do/).test(line);
        if (platformsMatch) {
            const platformsLineNumber = lineNumber;
            let platformsContent = '';
            let platformsLine = '';
            while (lineNumber < lines.length && platformsLine !== 'end') {
                lineNumber += 1;
                platformsLine = lines[lineNumber];
                if (platformsLine !== 'end') {
                    platformsContent += formatContent(platformsLine);
                }
            }
            const platformsRes = await extractPackageFile(platformsContent);
            if (platformsRes) {
                res.deps = res.deps.concat(platformsRes.deps.map((dep) => ({
                    ...dep,
                    managerData: {
                        lineNumber: Number(dep.managerData?.lineNumber) + platformsLineNumber + 1,
                    },
                })));
            }
        }
        const ifMatch = (0, regex_1.regEx)(/^if\s+(.*?)/).test(line);
        if (ifMatch) {
            const ifLineNumber = lineNumber;
            let ifContent = '';
            let ifLine = '';
            while (lineNumber < lines.length && ifLine !== 'end') {
                lineNumber += 1;
                ifLine = lines[lineNumber];
                if (ifLine !== 'end') {
                    ifContent += formatContent(ifLine);
                }
            }
            const ifRes = await extractPackageFile(ifContent);
            if (ifRes) {
                res.deps = res.deps.concat(ifRes.deps.map((dep) => ({
                    ...dep,
                    managerData: {
                        lineNumber: Number(dep.managerData?.lineNumber) + ifLineNumber + 1,
                    },
                })));
            }
        }
    }
    if (!res.deps.length && !res.registryUrls?.length) {
        return null;
    }
    if (fileName) {
        const gemfileLock = fileName + '.lock';
        const lockContent = await (0, fs_1.readLocalFile)(gemfileLock, 'utf8');
        if (lockContent) {
            logger_1.logger.debug({ packageFile: fileName }, 'Found Gemfile.lock file');
            res.lockFiles = [gemfileLock];
            const lockedEntries = (0, locked_version_1.extractLockFileEntries)(lockContent);
            for (const dep of res.deps) {
                const lockedDepValue = lockedEntries.get(`${dep.depName}`);
                if (lockedDepValue) {
                    dep.lockedVersion = lockedDepValue;
                }
            }
        }
    }
    return res;
}
exports.extractPackageFile = extractPackageFile;
//# sourceMappingURL=extract.js.map