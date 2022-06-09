"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPackageFile = void 0;
const tslib_1 = require("tslib");
const toml_1 = require("@iarna/toml");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const logger_1 = require("../../../logger");
const fs_1 = require("../../../util/fs");
const pypi_1 = require("../../datasource/pypi");
const pep440Versioning = tslib_1.__importStar(require("../../versioning/pep440"));
const poetryVersioning = tslib_1.__importStar(require("../../versioning/poetry"));
const locked_version_1 = require("./locked-version");
function extractFromSection(parsedFile, section, poetryLockfile) {
    const deps = [];
    const sectionContent = parsedFile.tool?.poetry?.[section];
    if (!sectionContent) {
        return [];
    }
    for (const depName of Object.keys(sectionContent)) {
        if (depName === 'python' || depName === 'source') {
            continue;
        }
        let skipReason = null;
        let currentValue = sectionContent[depName];
        let nestedVersion = false;
        if (!is_1.default.string(currentValue)) {
            const version = currentValue.version;
            const path = currentValue.path;
            const git = currentValue.git;
            if (version) {
                currentValue = version;
                nestedVersion = true;
                if (path || git) {
                    skipReason = path ? 'path-dependency' : 'git-dependency';
                }
            }
            else if (path) {
                currentValue = '';
                skipReason = 'path-dependency';
            }
            else if (git) {
                currentValue = '';
                skipReason = 'git-dependency';
            }
            else {
                currentValue = '';
                skipReason = 'multiple-constraint-dep';
            }
        }
        const dep = {
            depName,
            depType: section,
            currentValue: currentValue,
            managerData: { nestedVersion },
            datasource: pypi_1.PypiDatasource.id,
        };
        if (depName in poetryLockfile) {
            dep.lockedVersion = poetryLockfile[depName];
        }
        if (skipReason) {
            dep.skipReason = skipReason;
        }
        else if (pep440Versioning.isValid(currentValue)) {
            dep.versioning = pep440Versioning.id;
        }
        else if (poetryVersioning.isValid(currentValue)) {
            dep.versioning = poetryVersioning.id;
        }
        else {
            dep.skipReason = 'unknown-version';
        }
        deps.push(dep);
    }
    return deps;
}
function extractRegistries(pyprojectfile) {
    const sources = pyprojectfile.tool?.poetry?.source;
    if (!Array.isArray(sources) || sources.length === 0) {
        return undefined;
    }
    const registryUrls = new Set();
    for (const source of sources) {
        if (source.url) {
            registryUrls.add(source.url);
        }
    }
    registryUrls.add(process.env.PIP_INDEX_URL || 'https://pypi.org/pypi/');
    return Array.from(registryUrls);
}
async function extractPackageFile(content, fileName) {
    logger_1.logger.trace(`poetry.extractPackageFile(${fileName})`);
    let pyprojectfile;
    try {
        pyprojectfile = (0, toml_1.parse)(content);
    }
    catch (err) {
        logger_1.logger.debug({ err }, 'Error parsing pyproject.toml file');
        return null;
    }
    if (!pyprojectfile.tool?.poetry) {
        logger_1.logger.debug(`${fileName} contains no poetry section`);
        return null;
    }
    // handle the lockfile
    const lockfileName = (0, fs_1.getSiblingFileName)(fileName, 'poetry.lock');
    const lockContents = await (0, fs_1.readLocalFile)(lockfileName, 'utf8');
    const lockfileMapping = (0, locked_version_1.extractLockFileEntries)(lockContents);
    const deps = [
        ...extractFromSection(pyprojectfile, 'dependencies', lockfileMapping),
        ...extractFromSection(pyprojectfile, 'dev-dependencies', lockfileMapping),
        ...extractFromSection(pyprojectfile, 'extras', lockfileMapping),
    ];
    if (!deps.length) {
        return null;
    }
    const constraints = {};
    if (is_1.default.nonEmptyString(pyprojectfile.tool?.poetry?.dependencies?.python)) {
        constraints.python = pyprojectfile.tool?.poetry?.dependencies?.python;
    }
    const res = {
        deps,
        registryUrls: extractRegistries(pyprojectfile),
        constraints,
    };
    // Try poetry.lock first
    let lockFile = (0, fs_1.getSiblingFileName)(fileName, 'poetry.lock');
    // istanbul ignore next
    if (await (0, fs_1.localPathExists)(lockFile)) {
        res.lockFiles = [lockFile];
    }
    else {
        // Try pyproject.lock next
        lockFile = (0, fs_1.getSiblingFileName)(fileName, 'pyproject.lock');
        if (await (0, fs_1.localPathExists)(lockFile)) {
            res.lockFiles = [lockFile];
        }
    }
    return res;
}
exports.extractPackageFile = extractPackageFile;
//# sourceMappingURL=extract.js.map