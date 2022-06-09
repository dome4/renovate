"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = exports.getSatisfyingVersion = exports.isValid = exports.isVersion = exports.supportsRanges = exports.urls = exports.displayName = exports.id = void 0;
const tslib_1 = require("tslib");
const semver_1 = tslib_1.__importDefault(require("semver"));
const semver_stable_1 = tslib_1.__importDefault(require("semver-stable"));
exports.id = 'semver';
exports.displayName = 'Semantic';
exports.urls = ['https://semver.org/'];
exports.supportsRanges = false;
const { is: isStable } = semver_stable_1.default;
const { compare: sortVersions, maxSatisfying: getSatisfyingVersion, minSatisfying: minSatisfyingVersion, major: getMajor, minor: getMinor, patch: getPatch, satisfies: matches, valid, ltr: isLessThanRange, gt: isGreaterThan, eq: equals, } = semver_1.default;
exports.getSatisfyingVersion = getSatisfyingVersion;
// If this is left as an alias, inputs like "17.04.0" throw errors
const isVersion = (input) => !!valid(input);
exports.isVersion = isVersion;
exports.isValid = exports.isVersion;
function getNewValue({ newVersion }) {
    return newVersion;
}
function isCompatible(version) {
    return (0, exports.isVersion)(version);
}
function isSingleVersion(version) {
    return (0, exports.isVersion)(version);
}
function isValid(input) {
    return (0, exports.isVersion)(input);
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
    isVersion: exports.isVersion,
    matches,
    getSatisfyingVersion,
    minSatisfyingVersion,
    getNewValue,
    sortVersions,
};
exports.default = exports.api;
//# sourceMappingURL=index.js.map