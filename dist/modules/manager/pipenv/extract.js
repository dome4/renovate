"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPackageFile = void 0;
const tslib_1 = require("tslib");
const toml_1 = tslib_1.__importDefault(require("@iarna/toml"));
const pep440_1 = require("@renovatebot/pep440");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const logger_1 = require("../../../logger");
const fs_1 = require("../../../util/fs");
const regex_1 = require("../../../util/regex");
const pypi_1 = require("../../datasource/pypi");
// based on https://www.python.org/dev/peps/pep-0508/#names
const packageRegex = (0, regex_1.regEx)(/^([A-Z0-9]|[A-Z0-9][A-Z0-9._-]*[A-Z0-9])$/i);
const rangePattern = pep440_1.RANGE_PATTERN;
const specifierPartPattern = `\\s*${rangePattern.replace((0, regex_1.regEx)(/\?<\w+>/g), '?:')}\\s*`;
const specifierPattern = `${specifierPartPattern}(?:,${specifierPartPattern})*`;
const specifierRegex = (0, regex_1.regEx)(`^${specifierPattern}$`);
function extractFromSection(pipfile, section) {
    const pipfileSection = pipfile[section];
    if (!pipfileSection) {
        return [];
    }
    const deps = Object.entries(pipfileSection)
        .map((x) => {
        const [depName, requirements] = x;
        let currentValue;
        let nestedVersion = false;
        let skipReason;
        if (requirements.git) {
            skipReason = 'git-dependency';
        }
        else if (requirements.file) {
            skipReason = 'file-dependency';
        }
        else if (requirements.path) {
            skipReason = 'local-dependency';
        }
        else if (requirements.version) {
            currentValue = requirements.version;
            nestedVersion = true;
        }
        else if (is_1.default.object(requirements)) {
            skipReason = 'any-version';
        }
        else {
            currentValue = requirements;
        }
        if (currentValue === '*') {
            skipReason = 'any-version';
        }
        if (!skipReason) {
            const packageMatches = packageRegex.exec(depName);
            if (!packageMatches) {
                logger_1.logger.debug(`Skipping dependency with malformed package name "${depName}".`);
                skipReason = 'invalid-name';
            }
            // validated above
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            const specifierMatches = specifierRegex.exec(currentValue);
            if (!specifierMatches) {
                logger_1.logger.debug(`Skipping dependency with malformed version specifier "${currentValue}".`);
                skipReason = 'invalid-version';
            }
        }
        const dep = {
            depType: section,
            depName,
            managerData: {},
        };
        if (currentValue) {
            dep.currentValue = currentValue;
        }
        if (skipReason) {
            dep.skipReason = skipReason;
        }
        else {
            dep.datasource = pypi_1.PypiDatasource.id;
        }
        if (nestedVersion) {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            dep.managerData.nestedVersion = nestedVersion;
        }
        if (requirements.index) {
            if (is_1.default.array(pipfile.source)) {
                const source = pipfile.source.find((item) => item.name === requirements.index);
                if (source) {
                    dep.registryUrls = [source.url];
                }
            }
        }
        return dep;
    })
        .filter(Boolean);
    return deps;
}
async function extractPackageFile(content, fileName) {
    logger_1.logger.debug('pipenv.extractPackageFile()');
    let pipfile;
    try {
        // TODO: fix type (#9610)
        pipfile = toml_1.default.parse(content);
    }
    catch (err) {
        logger_1.logger.debug({ err }, 'Error parsing Pipfile');
        return null;
    }
    const res = { deps: [] };
    if (pipfile.source) {
        res.registryUrls = pipfile.source.map((source) => source.url);
    }
    res.deps = [
        ...extractFromSection(pipfile, 'packages'),
        ...extractFromSection(pipfile, 'dev-packages'),
    ];
    if (!res.deps.length) {
        return null;
    }
    const constraints = {};
    if (is_1.default.nonEmptyString(pipfile.requires?.python_version)) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        constraints.python = `== ${pipfile.requires.python_version}.*`;
    }
    else if (is_1.default.nonEmptyString(pipfile.requires?.python_full_version)) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        constraints.python = `== ${pipfile.requires.python_full_version}`;
    }
    if (is_1.default.nonEmptyString(pipfile.packages?.pipenv)) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        constraints.pipenv = pipfile.packages.pipenv;
    }
    else if (is_1.default.nonEmptyString(pipfile['dev-packages']?.pipenv)) {
        constraints.pipenv = pipfile['dev-packages'].pipenv;
    }
    const lockFileName = fileName + '.lock';
    if (await (0, fs_1.localPathExists)(lockFileName)) {
        res.lockFiles = [lockFileName];
    }
    res.constraints = constraints;
    return res;
}
exports.extractPackageFile = extractPackageFile;
//# sourceMappingURL=extract.js.map