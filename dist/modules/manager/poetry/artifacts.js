"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateArtifacts = void 0;
const tslib_1 = require("tslib");
const toml_1 = require("@iarna/toml");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const shlex_1 = require("shlex");
const error_messages_1 = require("../../../constants/error-messages");
const logger_1 = require("../../../logger");
const exec_1 = require("../../../util/exec");
const fs_1 = require("../../../util/fs");
const host_rules_1 = require("../../../util/host-rules");
const regex_1 = require("../../../util/regex");
const pypi_1 = require("../../datasource/pypi");
const extract_1 = require("../pip_requirements/extract");
function getPythonConstraint(existingLockFileContent, config) {
    const { constraints = {} } = config;
    const { python } = constraints;
    if (python) {
        logger_1.logger.debug('Using python constraint from config');
        return python;
    }
    try {
        const data = (0, toml_1.parse)(existingLockFileContent);
        if (is_1.default.string(data?.metadata?.['python-versions'])) {
            return data?.metadata?.['python-versions'];
        }
    }
    catch (err) {
        // Do nothing
    }
    return undefined;
}
const pkgValRegex = (0, regex_1.regEx)(`^${extract_1.dependencyPattern}$`);
function getPoetryRequirement(pyProjectContent) {
    try {
        const pyproject = (0, toml_1.parse)(pyProjectContent);
        // https://python-poetry.org/docs/pyproject/#poetry-and-pep-517
        const buildBackend = pyproject['build-system']?.['build-backend'];
        if ((buildBackend === 'poetry.masonry.api' ||
            buildBackend === 'poetry.core.masonry.api') &&
            is_1.default.nonEmptyArray(pyproject['build-system']?.requires)) {
            for (const requirement of pyproject['build-system'].requires) {
                if (is_1.default.nonEmptyString(requirement)) {
                    const pkgValMatch = pkgValRegex.exec(requirement);
                    if (pkgValMatch) {
                        const [, depName, , currVal] = pkgValMatch;
                        if ((depName === 'poetry' || depName === 'poetry_core') &&
                            currVal) {
                            return currVal.trim();
                        }
                    }
                }
            }
        }
    }
    catch (err) {
        logger_1.logger.debug({ err }, 'Error parsing pyproject.toml file');
    }
    return null;
}
function getPoetrySources(content, fileName) {
    let pyprojectFile;
    try {
        pyprojectFile = (0, toml_1.parse)(content);
    }
    catch (err) {
        logger_1.logger.debug({ err }, 'Error parsing pyproject.toml file');
        return [];
    }
    if (!pyprojectFile.tool?.poetry) {
        logger_1.logger.debug(`{$fileName} contains no poetry section`);
        return [];
    }
    const sources = pyprojectFile.tool?.poetry?.source || [];
    const sourceArray = [];
    for (const source of sources) {
        if (source.name && source.url) {
            sourceArray.push({ name: source.name, url: source.url });
        }
    }
    return sourceArray;
}
function getMatchingHostRule(source) {
    const scopedMatch = (0, host_rules_1.find)({ hostType: pypi_1.PypiDatasource.id, url: source.url });
    return is_1.default.nonEmptyObject(scopedMatch)
        ? scopedMatch
        : (0, host_rules_1.find)({ url: source.url });
}
function getSourceCredentialVars(pyprojectContent, packageFileName) {
    const poetrySources = getPoetrySources(pyprojectContent, packageFileName);
    const envVars = {};
    for (const source of poetrySources) {
        const matchingHostRule = getMatchingHostRule(source);
        const formattedSourceName = source.name
            .replace((0, regex_1.regEx)(/(\.|-)+/g), '_')
            .toUpperCase();
        if (matchingHostRule.username) {
            envVars[`POETRY_HTTP_BASIC_${formattedSourceName}_USERNAME`] =
                matchingHostRule.username;
        }
        if (matchingHostRule.password) {
            envVars[`POETRY_HTTP_BASIC_${formattedSourceName}_PASSWORD`] =
                matchingHostRule.password;
        }
    }
    return envVars;
}
async function updateArtifacts({ packageFileName, updatedDeps, newPackageFileContent, config, }) {
    logger_1.logger.debug(`poetry.updateArtifacts(${packageFileName})`);
    const isLockFileMaintenance = config.updateType === 'lockFileMaintenance';
    if (!is_1.default.nonEmptyArray(updatedDeps) && !isLockFileMaintenance) {
        logger_1.logger.debug('No updated poetry deps - returning null');
        return null;
    }
    // Try poetry.lock first
    let lockFileName = (0, fs_1.getSiblingFileName)(packageFileName, 'poetry.lock');
    let existingLockFileContent = await (0, fs_1.readLocalFile)(lockFileName, 'utf8');
    if (!existingLockFileContent) {
        // Try pyproject.lock next
        lockFileName = (0, fs_1.getSiblingFileName)(packageFileName, 'pyproject.lock');
        existingLockFileContent = await (0, fs_1.readLocalFile)(lockFileName, 'utf8');
        if (!existingLockFileContent) {
            logger_1.logger.debug(`No lock file found`);
            return null;
        }
    }
    logger_1.logger.debug(`Updating ${lockFileName}`);
    try {
        await (0, fs_1.writeLocalFile)(packageFileName, newPackageFileContent);
        const cmd = [];
        if (isLockFileMaintenance) {
            await (0, fs_1.deleteLocalFile)(lockFileName);
            cmd.push('poetry update --lock --no-interaction');
        }
        else {
            cmd.push(`poetry update --lock --no-interaction ${updatedDeps
                .map((dep) => dep.depName)
                .filter(is_1.default.string)
                .map((dep) => (0, shlex_1.quote)(dep))
                .join(' ')}`);
        }
        const tagConstraint = getPythonConstraint(existingLockFileContent, config);
        const constraint = config.constraints?.poetry || getPoetryRequirement(newPackageFileContent);
        const extraEnv = getSourceCredentialVars(newPackageFileContent, packageFileName);
        const toolConstraint = {
            toolName: 'poetry',
            constraint,
        };
        const execOptions = {
            cwdFile: packageFileName,
            extraEnv,
            docker: {
                image: 'python',
                tagConstraint,
                tagScheme: 'poetry',
            },
            toolConstraints: [toolConstraint],
        };
        await (0, exec_1.exec)(cmd, execOptions);
        const newPoetryLockContent = await (0, fs_1.readLocalFile)(lockFileName, 'utf8');
        if (existingLockFileContent === newPoetryLockContent) {
            logger_1.logger.debug(`${lockFileName} is unchanged`);
            return null;
        }
        logger_1.logger.debug(`Returning updated ${lockFileName}`);
        return [
            {
                file: {
                    type: 'addition',
                    path: lockFileName,
                    contents: newPoetryLockContent,
                },
            },
        ];
    }
    catch (err) {
        // istanbul ignore if
        if (err.message === error_messages_1.TEMPORARY_ERROR) {
            throw err;
        }
        logger_1.logger.debug({ err }, `Failed to update ${lockFileName} file`);
        return [
            {
                artifactError: {
                    lockFile: lockFileName,
                    stderr: `${String(err.stdout)}\n${String(err.stderr)}`,
                },
            },
        ];
    }
}
exports.updateArtifacts = updateArtifacts;
//# sourceMappingURL=artifacts.js.map