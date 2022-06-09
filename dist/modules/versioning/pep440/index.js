"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = exports.matches = exports.isVersion = exports.isSingleVersion = exports.isValid = exports.supportedRangeStrategies = exports.supportsRanges = exports.urls = exports.displayName = exports.id = void 0;
const tslib_1 = require("tslib");
const pep440 = tslib_1.__importStar(require("@renovatebot/pep440"));
const range_1 = require("./range");
exports.id = 'pep440';
exports.displayName = 'PEP440';
exports.urls = ['https://www.python.org/dev/peps/pep-0440/'];
exports.supportsRanges = true;
exports.supportedRangeStrategies = [
    'bump',
    'widen',
    'pin',
    'replace',
];
const { compare: sortVersions, satisfies: matches, valid, validRange, explain, gt: isGreaterThan, major: getMajor, minor: getMinor, patch: getPatch, eq, } = pep440;
exports.matches = matches;
function isVersion(input) {
    // @renovatebot/pep440 isn't strict null save
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    return !!valid(input);
}
exports.isVersion = isVersion;
const isStable = (input) => {
    const version = explain(input);
    if (!version) {
        return false;
    }
    return !version.is_prerelease;
};
// If this is left as an alias, inputs like "17.04.0" throw errors
function isValid(input) {
    return validRange(input) || isVersion(input);
}
exports.isValid = isValid;
function getSatisfyingVersion(versions, range) {
    const found = pep440.filter(versions, range).sort(sortVersions);
    return found.length === 0 ? null : found[found.length - 1];
}
function minSatisfyingVersion(versions, range) {
    const found = pep440.filter(versions, range).sort(sortVersions);
    return found.length === 0 ? null : found[0];
}
function isSingleVersion(constraint) {
    return (isVersion(constraint) ||
        (constraint?.startsWith('==') && isVersion(constraint.substring(2).trim())));
}
exports.isSingleVersion = isSingleVersion;
const equals = (version1, version2) => isVersion(version1) && isVersion(version2) && eq(version1, version2);
exports.api = {
    equals,
    getMajor,
    getMinor,
    getPatch,
    isCompatible: isVersion,
    isGreaterThan,
    isSingleVersion,
    isStable,
    isValid,
    isVersion,
    matches,
    getSatisfyingVersion,
    minSatisfyingVersion,
    getNewValue: range_1.getNewValue,
    sortVersions,
    isLessThanRange: range_1.isLessThanRange,
};
exports.default = exports.api;
//# sourceMappingURL=index.js.map