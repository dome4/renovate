"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPackageFile = void 0;
const logger_1 = require("../../../logger");
const fs_1 = require("../../../util/fs");
const regex_1 = require("../../../util/regex");
const hex_1 = require("../../datasource/hex");
const depSectionRegExp = (0, regex_1.regEx)(/defp\s+deps.*do/g);
const depMatchRegExp = (0, regex_1.regEx)(/{:(?<depName>\w+),\s*(?<datasource>[^:"]+)?:?\s*"(?<currentValue>[^"]+)",?\s*(?:organization: "(?<organization>.*)")?.*}/gm);
async function extractPackageFile(content, fileName) {
    logger_1.logger.trace('mix.extractPackageFile()');
    const deps = [];
    const contentArr = content.split(regex_1.newlineRegex);
    for (let lineNumber = 0; lineNumber < contentArr.length; lineNumber += 1) {
        if (contentArr[lineNumber].match(depSectionRegExp)) {
            logger_1.logger.trace(`Matched dep section on line ${lineNumber}`);
            let depBuffer = '';
            do {
                depBuffer += contentArr[lineNumber] + '\n';
                lineNumber += 1;
            } while (!contentArr[lineNumber].includes('end'));
            let depMatchGroups = depMatchRegExp.exec(depBuffer)?.groups;
            while (depMatchGroups) {
                const { depName, datasource, currentValue, organization } = depMatchGroups;
                const dep = {
                    depName,
                    currentValue,
                };
                dep.datasource = datasource || hex_1.HexDatasource.id;
                if (dep.datasource === hex_1.HexDatasource.id) {
                    dep.currentValue = currentValue;
                    dep.packageName = depName;
                }
                if (organization) {
                    dep.packageName += ':' + organization;
                }
                if (dep.datasource !== hex_1.HexDatasource.id) {
                    dep.skipReason = 'non-hex-dep-types';
                }
                deps.push(dep);
                depMatchGroups = depMatchRegExp.exec(depBuffer)?.groups;
            }
        }
    }
    const res = { deps };
    const lockFileName = (await (0, fs_1.findLocalSiblingOrParent)(fileName, 'mix.lock')) || 'mix.lock';
    // istanbul ignore if
    if (await (0, fs_1.localPathExists)(lockFileName)) {
        res.lockFiles = [lockFileName];
    }
    return res;
}
exports.extractPackageFile = extractPackageFile;
//# sourceMappingURL=extract.js.map