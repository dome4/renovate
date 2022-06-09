"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = exports.isVersion = exports.isValid = exports.supportedRangeStrategies = exports.supportsRanges = exports.urls = exports.displayName = exports.id = void 0;
const tslib_1 = require("tslib");
const semver_1 = tslib_1.__importDefault(require("semver"));
const semver_stable_1 = tslib_1.__importDefault(require("semver-stable"));
const regex_1 = require("../../../util/regex");
const range_1 = require("./range");
exports.id = 'swift';
exports.displayName = 'Swift';
exports.urls = ['https://swift.org/package-manager/'];
exports.supportsRanges = true;
exports.supportedRangeStrategies = [
    'bump',
    'widen',
    'pin',
    'replace',
];
const { is: isStable } = semver_stable_1.default;
const { compare: sortVersions, maxSatisfying, minSatisfying, major: getMajor, minor: getMinor, patch: getPatch, satisfies, valid, validRange, ltr, gt: isGreaterThan, eq: equals, } = semver_1.default;
const isValid = (input) => !!valid(input) || !!validRange((0, range_1.toSemverRange)(input));
exports.isValid = isValid;
const isVersion = (input) => !!valid(input);
exports.isVersion = isVersion;
function getSatisfyingVersion(versions, range) {
    const normalizedVersions = versions.map((v) => v.replace((0, regex_1.regEx)(/^v/), ''));
    const semverRange = (0, range_1.toSemverRange)(range);
    return semverRange ? maxSatisfying(normalizedVersions, semverRange) : null;
}
function minSatisfyingVersion(versions, range) {
    const normalizedVersions = versions.map((v) => v.replace((0, regex_1.regEx)(/^v/), ''));
    const semverRange = (0, range_1.toSemverRange)(range);
    return semverRange ? minSatisfying(normalizedVersions, semverRange) : null;
}
function isLessThanRange(version, range) {
    const semverRange = (0, range_1.toSemverRange)(range);
    return semverRange ? ltr(version, semverRange) : false;
}
function matches(version, range) {
    const semverRange = (0, range_1.toSemverRange)(range);
    return semverRange ? satisfies(version, semverRange) : false;
}
exports.api = {
    equals,
    getMajor,
    getMinor,
    getNewValue: range_1.getNewValue,
    getPatch,
    isCompatible: exports.isVersion,
    isGreaterThan,
    isLessThanRange,
    isSingleVersion: exports.isVersion,
    isStable,
    isValid: exports.isValid,
    isVersion: exports.isVersion,
    matches,
    getSatisfyingVersion,
    minSatisfyingVersion,
    sortVersions,
};
exports.default = exports.api;
//# sourceMappingURL=index.js.map