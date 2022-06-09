"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = exports.isValid = exports.supportedRangeStrategies = exports.supportsRanges = exports.urls = exports.displayName = exports.id = void 0;
const semver_utils_1 = require("semver-utils");
const logger_1 = require("../../../logger");
const npm_1 = require("../npm");
const patterns_1 = require("./patterns");
const transform_1 = require("./transform");
exports.id = 'poetry';
exports.displayName = 'Poetry';
exports.urls = ['https://python-poetry.org/docs/versions/'];
exports.supportsRanges = true;
exports.supportedRangeStrategies = [
    'bump',
    'widen',
    'pin',
    'replace',
];
function equals(a, b) {
    const semverA = (0, transform_1.poetry2semver)(a);
    const semverB = (0, transform_1.poetry2semver)(b);
    return !!(semverA && semverB && npm_1.api.equals(semverA, semverB));
}
function getMajor(version) {
    const semverVersion = (0, transform_1.poetry2semver)(version);
    return semverVersion ? npm_1.api.getMajor(semverVersion) : null;
}
function getMinor(version) {
    const semverVersion = (0, transform_1.poetry2semver)(version);
    return semverVersion ? npm_1.api.getMinor(semverVersion) : null;
}
function getPatch(version) {
    const semverVersion = (0, transform_1.poetry2semver)(version);
    return semverVersion ? npm_1.api.getPatch(semverVersion) : null;
}
function isVersion(input) {
    return patterns_1.VERSION_PATTERN.test(input);
}
function isGreaterThan(a, b) {
    const semverA = (0, transform_1.poetry2semver)(a);
    const semverB = (0, transform_1.poetry2semver)(b);
    return !!(semverA && semverB && npm_1.api.isGreaterThan(semverA, semverB));
}
function isLessThanRange(version, range) {
    const semverVersion = (0, transform_1.poetry2semver)(version);
    return !!(isVersion(version) &&
        semverVersion &&
        npm_1.api.isLessThanRange?.(semverVersion, (0, transform_1.poetry2npm)(range)));
}
function isValid(input) {
    return npm_1.api.isValid((0, transform_1.poetry2npm)(input));
}
exports.isValid = isValid;
function isStable(version) {
    const semverVersion = (0, transform_1.poetry2semver)(version);
    return !!(semverVersion && npm_1.api.isStable(semverVersion));
}
function matches(version, range) {
    const semverVersion = (0, transform_1.poetry2semver)(version);
    return !!(isVersion(version) &&
        semverVersion &&
        npm_1.api.matches(semverVersion, (0, transform_1.poetry2npm)(range)));
}
function getSatisfyingVersion(versions, range) {
    const semverVersions = [];
    versions.forEach((version) => {
        const semverVersion = (0, transform_1.poetry2semver)(version);
        if (semverVersion) {
            semverVersions.push(semverVersion);
        }
    });
    const npmRange = (0, transform_1.poetry2npm)(range);
    const satisfyingVersion = npm_1.api.getSatisfyingVersion(semverVersions, npmRange);
    return satisfyingVersion ? (0, transform_1.semver2poetry)(satisfyingVersion) : null;
}
function minSatisfyingVersion(versions, range) {
    const semverVersions = [];
    versions.forEach((version) => {
        const semverVersion = (0, transform_1.poetry2semver)(version);
        if (semverVersion) {
            semverVersions.push(semverVersion);
        }
    });
    const npmRange = (0, transform_1.poetry2npm)(range);
    const satisfyingVersion = npm_1.api.minSatisfyingVersion(semverVersions, npmRange);
    return satisfyingVersion ? (0, transform_1.semver2poetry)(satisfyingVersion) : null;
}
function isSingleVersion(constraint) {
    return ((constraint.trim().startsWith('=') &&
        isVersion(constraint.trim().substring(1).trim())) ||
        isVersion(constraint.trim()));
}
function handleShort(operator, currentValue, newVersion) {
    const toVersionMajor = getMajor(newVersion);
    const toVersionMinor = getMinor(newVersion);
    const split = currentValue.split('.');
    if (toVersionMajor !== null && split.length === 1) {
        // [^,~]4
        return `${operator}${toVersionMajor}`;
    }
    if (toVersionMajor !== null &&
        toVersionMinor !== null &&
        split.length === 2) {
        // [^,~]4.1
        return `${operator}${toVersionMajor}.${toVersionMinor}`;
    }
    return null;
}
function getNewValue({ currentValue, rangeStrategy, currentVersion, newVersion, }) {
    if (rangeStrategy === 'replace') {
        const npmCurrentValue = (0, transform_1.poetry2npm)(currentValue);
        try {
            const massagedNewVersion = (0, transform_1.poetry2semver)(newVersion);
            if (massagedNewVersion &&
                isVersion(massagedNewVersion) &&
                npm_1.api.matches(massagedNewVersion, npmCurrentValue)) {
                return currentValue;
            }
        }
        catch (err) /* istanbul ignore next */ {
            logger_1.logger.info({ err }, 'Poetry versioning: Error caught checking if newVersion satisfies currentValue');
        }
        const parsedRange = (0, semver_utils_1.parseRange)(npmCurrentValue);
        const element = parsedRange[parsedRange.length - 1];
        if (parsedRange.length === 1 && element.operator) {
            if (element.operator === '^') {
                const version = handleShort('^', npmCurrentValue, newVersion);
                if (version) {
                    return (0, transform_1.npm2poetry)(version);
                }
            }
            if (element.operator === '~') {
                const version = handleShort('~', npmCurrentValue, newVersion);
                if (version) {
                    return (0, transform_1.npm2poetry)(version);
                }
            }
        }
    }
    // Explicitly check whether this is a fully-qualified version
    if ((patterns_1.VERSION_PATTERN.exec(newVersion)?.groups?.release || '').split('.')
        .length !== 3) {
        logger_1.logger.debug('Cannot massage python version to npm - returning currentValue');
        return currentValue;
    }
    try {
        const currentSemverVersion = currentVersion && (0, transform_1.poetry2semver)(currentVersion);
        const newSemverVersion = (0, transform_1.poetry2semver)(newVersion);
        if (currentSemverVersion && newSemverVersion) {
            const newSemver = npm_1.api.getNewValue({
                currentValue: (0, transform_1.poetry2npm)(currentValue),
                rangeStrategy,
                currentVersion: currentSemverVersion,
                newVersion: newSemverVersion,
            });
            const newPoetry = newSemver && (0, transform_1.npm2poetry)(newSemver);
            if (newPoetry) {
                return newPoetry;
            }
        }
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.debug({ currentValue, rangeStrategy, currentVersion, newVersion, err }, 'Could not generate new value using npm.getNewValue()');
    }
    // istanbul ignore next
    return currentValue;
}
function sortVersions(a, b) {
    // istanbul ignore next
    return npm_1.api.sortVersions((0, transform_1.poetry2semver)(a) ?? '', (0, transform_1.poetry2semver)(b) ?? '');
}
exports.api = {
    equals,
    getMajor,
    getMinor,
    getPatch,
    getNewValue,
    getSatisfyingVersion,
    isCompatible: isVersion,
    isGreaterThan,
    isLessThanRange,
    isSingleVersion,
    isStable,
    isValid,
    isVersion,
    matches,
    minSatisfyingVersion,
    sortVersions,
};
exports.default = exports.api;
//# sourceMappingURL=index.js.map