"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPackageFile = void 0;
// based on https://www.python.org/dev/peps/pep-0508/#names
const pep440_1 = require("@renovatebot/pep440");
const logger_1 = require("../../../logger");
const regex_1 = require("../../../util/regex");
const pypi_1 = require("../../datasource/pypi");
function getSectionName(str) {
    const [, sectionName] = (0, regex_1.regEx)(/^\[\s*([^\s]+)\s*]\s*$/).exec(str) || [];
    return sectionName;
}
function getSectionRecord(str) {
    const [, sectionRecord] = (0, regex_1.regEx)(/^([^\s]+)\s+=/).exec(str) || [];
    return sectionRecord;
}
function getDepType(section, record) {
    if (section === 'options') {
        if (record === 'install_requires') {
            return 'install';
        }
        if (record === 'setup_requires') {
            return 'setup';
        }
        if (record === 'tests_require') {
            return 'test';
        }
    }
    if (section === 'options.extras_require') {
        return 'extra';
    }
    return null;
}
function parseDep(line, section, record) {
    const packagePattern = '[a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]';
    const extrasPattern = '(?:\\s*\\[[^\\]]+\\])?';
    const rangePattern = pep440_1.RANGE_PATTERN;
    const specifierPartPattern = `\\s*${rangePattern.replace((0, regex_1.regEx)(/\?<\w+>/g), '?:')}`;
    const specifierPattern = `${specifierPartPattern}(?:\\s*,${specifierPartPattern})*`;
    const dependencyPattern = `(${packagePattern})(${extrasPattern})(${specifierPattern})`;
    const pkgRegex = (0, regex_1.regEx)(`^(${packagePattern})$`);
    const pkgValRegex = (0, regex_1.regEx)(`^${dependencyPattern}$`);
    const depType = getDepType(section, record);
    if (!depType) {
        return null;
    }
    const [lineNoEnvMarkers] = line.split(';').map((part) => part.trim());
    const packageMatches = pkgValRegex.exec(lineNoEnvMarkers) || pkgRegex.exec(lineNoEnvMarkers);
    if (!packageMatches) {
        return null;
    }
    const [, depName, , currVal] = packageMatches;
    const currentValue = currVal?.trim();
    const dep = {
        depName,
        currentValue,
        datasource: pypi_1.PypiDatasource.id,
        depType: depType,
    };
    if (currentValue?.startsWith('==')) {
        dep.currentVersion = currentValue.replace(/^==\s*/, '');
    }
    return dep;
}
function extractPackageFile(content) {
    logger_1.logger.trace('setup-cfg.extractPackageFile()');
    let sectionName = null;
    let sectionRecord = null;
    const deps = [];
    content
        .split(regex_1.newlineRegex)
        .map((line) => line.replace((0, regex_1.regEx)(/#.*$/), '').trimEnd())
        .forEach((rawLine) => {
        let line = rawLine;
        const newSectionName = getSectionName(line);
        const newSectionRecord = getSectionRecord(line);
        if (newSectionName) {
            sectionName = newSectionName;
        }
        if (newSectionRecord) {
            sectionRecord = newSectionRecord;
            // Propably there are also requirements in this line.
            line = rawLine.replace((0, regex_1.regEx)(/^[^=]*=\s*/), '');
            line.split(';').forEach((part) => {
                const dep = parseDep(part, sectionName, sectionRecord);
                if (dep) {
                    deps.push(dep);
                }
            });
            return;
        }
        const dep = parseDep(line, sectionName, sectionRecord);
        if (dep) {
            deps.push(dep);
        }
    });
    return deps.length ? { deps } : null;
}
exports.extractPackageFile = extractPackageFile;
//# sourceMappingURL=extract.js.map