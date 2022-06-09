"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = exports.isVersion = exports.isValid = exports.supportedRangeStrategies = exports.supportsRanges = exports.urls = exports.displayName = exports.id = void 0;
const tslib_1 = require("tslib");
const semver_1 = tslib_1.__importDefault(require("semver"));
const semver_utils_1 = require("semver-utils");
const logger_1 = require("../../../logger");
const regex_1 = require("../../../util/regex");
const npm_1 = require("../npm");
exports.id = 'composer';
exports.displayName = 'Composer';
exports.urls = [
    'https://getcomposer.org/doc/articles/versions.md',
    'https://packagist.org/packages/composer/semver',
    'https://madewithlove.be/tilde-and-caret-constraints/',
    'https://semver.mwl.be',
];
exports.supportsRanges = true;
exports.supportedRangeStrategies = [
    'bump',
    'widen',
    'pin',
    'replace',
    'update-lockfile',
];
function getVersionParts(input) {
    const versionParts = input.split('-');
    if (versionParts.length === 1) {
        return [input, ''];
    }
    return [versionParts[0], '-' + versionParts[1]];
}
function padZeroes(input) {
    const [output, stability] = getVersionParts(input);
    const sections = output.split('.');
    while (sections.length < 3) {
        sections.push('0');
    }
    return sections.join('.') + stability;
}
function convertStabilityModifier(input) {
    // Handle stability modifiers.
    const versionParts = input.split('@');
    if (versionParts.length === 1) {
        return input;
    }
    // 1.0@beta2 to 1.0-beta.2
    const stability = versionParts[1].replace((0, regex_1.regEx)(/(?:^|\s)(beta|alpha|rc)([1-9][0-9]*)(?: |$)/gi), '$1.$2');
    // If there is a stability part, npm semver expects the version
    // to be full
    return padZeroes(versionParts[0]) + '-' + stability;
}
function normalizeVersion(input) {
    let output = input;
    output = output.replace((0, regex_1.regEx)(/(^|>|>=|\^|~)v/i), '$1');
    return convertStabilityModifier(output);
}
function composer2npm(input) {
    const cleanInput = normalizeVersion(input);
    if (npm_1.api.isVersion(cleanInput)) {
        return cleanInput;
    }
    if (npm_1.api.isVersion(padZeroes(cleanInput))) {
        return padZeroes(cleanInput);
    }
    const [versionId, stability] = getVersionParts(cleanInput);
    let output = versionId;
    // ~4 to ^4 and ~4.1 to ^4.1
    output = output.replace((0, regex_1.regEx)(/(?:^|\s)~([1-9][0-9]*(?:\.[0-9]*)?)(?: |$)/g), '^$1');
    // ~0.4 to >=0.4 <1
    output = output.replace((0, regex_1.regEx)(/(?:^|\s)~(0\.[1-9][0-9]*)(?: |$)/g), '>=$1 <1');
    return output + stability;
}
function equals(a, b) {
    return npm_1.api.equals(composer2npm(a), composer2npm(b));
}
function getMajor(version) {
    const semverVersion = semver_1.default.coerce(composer2npm(version));
    return semverVersion ? npm_1.api.getMajor(semverVersion) : null;
}
function getMinor(version) {
    const semverVersion = semver_1.default.coerce(composer2npm(version));
    return semverVersion ? npm_1.api.getMinor(semverVersion) : null;
}
function getPatch(version) {
    const semverVersion = semver_1.default.coerce(composer2npm(version));
    return semverVersion ? npm_1.api.getPatch(semverVersion) : null;
}
function isGreaterThan(a, b) {
    return npm_1.api.isGreaterThan(composer2npm(a), composer2npm(b));
}
function isLessThanRange(version, range) {
    return !!npm_1.api.isLessThanRange?.(composer2npm(version), composer2npm(range));
}
function isSingleVersion(input) {
    return !!input && npm_1.api.isSingleVersion(composer2npm(input));
}
function isStable(version) {
    return !!(version && npm_1.api.isStable(composer2npm(version)));
}
function isValid(input) {
    return !!input && npm_1.api.isValid(composer2npm(input));
}
exports.isValid = isValid;
function isVersion(input) {
    return !!input && npm_1.api.isVersion(composer2npm(input));
}
exports.isVersion = isVersion;
function matches(version, range) {
    return npm_1.api.matches(composer2npm(version), composer2npm(range));
}
function getSatisfyingVersion(versions, range) {
    return npm_1.api.getSatisfyingVersion(versions.map(composer2npm), composer2npm(range));
}
function minSatisfyingVersion(versions, range) {
    return npm_1.api.minSatisfyingVersion(versions.map(composer2npm), composer2npm(range));
}
function getNewValue({ currentValue, rangeStrategy, currentVersion, newVersion, }) {
    if (rangeStrategy === 'pin') {
        return newVersion;
    }
    if (rangeStrategy === 'update-lockfile') {
        if (matches(newVersion, currentValue)) {
            return currentValue;
        }
        return getNewValue({
            currentValue,
            rangeStrategy: 'replace',
            currentVersion,
            newVersion,
        });
    }
    const currentMajor = currentVersion ? getMajor(currentVersion) : null;
    const toMajor = getMajor(newVersion);
    const toMinor = getMinor(newVersion);
    let newValue = null;
    if (isVersion(currentValue)) {
        newValue = newVersion;
    }
    else if ((0, regex_1.regEx)(/^[~^](0\.[1-9][0-9]*)$/).test(currentValue)) {
        const operator = currentValue.substr(0, 1);
        // handle ~0.4 case first
        if (toMajor === 0) {
            newValue = `${operator}0.${toMinor}`;
        }
        else {
            newValue = `${operator}${toMajor}.0`;
        }
    }
    else if ((0, regex_1.regEx)(/^[~^]([0-9]*)$/).test(currentValue)) {
        // handle ~4 case
        const operator = currentValue.substr(0, 1);
        newValue = `${operator}${toMajor}`;
    }
    else if (toMajor &&
        (0, regex_1.regEx)(/^[~^]([0-9]*(?:\.[0-9]*)?)$/).test(currentValue)) {
        const operator = currentValue.substr(0, 1);
        // handle ~4.1 case
        if ((currentMajor && toMajor > currentMajor) || !toMinor) {
            newValue = `${operator}${toMajor}.0`;
        }
        else {
            newValue = `${operator}${toMajor}.${toMinor}`;
        }
    }
    else if (currentVersion &&
        npm_1.api.isVersion(padZeroes(normalizeVersion(newVersion))) &&
        npm_1.api.isValid(normalizeVersion(currentValue)) &&
        composer2npm(currentValue) === normalizeVersion(currentValue)) {
        newValue = npm_1.api.getNewValue({
            currentValue: normalizeVersion(currentValue),
            rangeStrategy,
            currentVersion: padZeroes(normalizeVersion(currentVersion)),
            newVersion: padZeroes(normalizeVersion(newVersion)),
        });
    }
    if (rangeStrategy === 'widen' && matches(newVersion, currentValue)) {
        newValue = currentValue;
    }
    else {
        const hasOr = currentValue.includes(' || ');
        if (hasOr || rangeStrategy === 'widen') {
            const splitValues = currentValue.split('||');
            const lastValue = splitValues[splitValues.length - 1];
            const replacementValue = getNewValue({
                currentValue: lastValue.trim(),
                rangeStrategy: 'replace',
                currentVersion,
                newVersion,
            });
            if (rangeStrategy === 'replace') {
                newValue = replacementValue;
            }
            else if (replacementValue) {
                const parsedRange = (0, semver_utils_1.parseRange)(replacementValue);
                const element = parsedRange[parsedRange.length - 1];
                if (element.operator?.startsWith('<')) {
                    const splitCurrent = currentValue.split(element.operator);
                    splitCurrent.pop();
                    newValue = splitCurrent.join(element.operator) + replacementValue;
                }
                else {
                    newValue = currentValue + ' || ' + replacementValue;
                }
            }
        }
    }
    if (!newValue) {
        logger_1.logger.warn({ currentValue, rangeStrategy, currentVersion, newVersion }, 'Unsupported composer value');
        newValue = newVersion;
    }
    if (currentValue.split('.')[0].includes('v')) {
        newValue = newValue.replace((0, regex_1.regEx)(/([0-9])/), 'v$1');
    }
    // Preserve original min-stability specifier
    if (currentValue.includes('@')) {
        newValue += '@' + currentValue.split('@')[1];
    }
    return newValue;
}
function sortVersions(a, b) {
    return npm_1.api.sortVersions(composer2npm(a), composer2npm(b));
}
function isCompatible(version) {
    return isVersion(version);
}
exports.api = {
    equals,
    getMajor,
    getMinor,
    getPatch,
    isCompatible,
    isGreaterThan,
    isLessThanRange,
    isSingleVersion,
    isStable,
    isValid,
    isVersion,
    matches,
    getSatisfyingVersion,
    minSatisfyingVersion,
    getNewValue,
    sortVersions,
};
exports.default = exports.api;
//# sourceMappingURL=index.js.map