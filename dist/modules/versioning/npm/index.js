"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = exports.isVersion = exports.isValid = exports.supportedRangeStrategies = exports.supportsRanges = exports.urls = exports.displayName = exports.id = void 0;
const tslib_1 = require("tslib");
const semver_1 = tslib_1.__importDefault(require("semver"));
const semver_stable_1 = tslib_1.__importDefault(require("semver-stable"));
const range_1 = require("./range");
exports.id = 'npm';
exports.displayName = 'npm';
exports.urls = [
    'https://semver.org/',
    'https://www.npmjs.com/package/semver',
    'https://docs.npmjs.com/about-semantic-versioning',
    'https://semver.npmjs.com/',
];
exports.supportsRanges = true;
exports.supportedRangeStrategies = [
    'bump',
    'widen',
    'pin',
    'replace',
];
const { compare: sortVersions, maxSatisfying: getSatisfyingVersion, minSatisfying: minSatisfyingVersion, major: getMajor, minor: getMinor, patch: getPatch, satisfies: matches, valid, validRange, ltr: isLessThanRange, gt: isGreaterThan, eq: equals, } = semver_1.default;
// If this is left as an alias, inputs like "17.04.0" throw errors
const isValid = (input) => !!validRange(input);
exports.isValid = isValid;
const isVersion = (input) => !!valid(input);
exports.isVersion = isVersion;
function isSingleVersion(constraint) {
    return ((0, exports.isVersion)(constraint) ||
        (constraint?.startsWith('=') && (0, exports.isVersion)(constraint.substring(1).trim())));
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
    isSingleVersion,
    isStable: semver_stable_1.default.is,
    isValid: exports.isValid,
    isVersion: exports.isVersion,
    matches,
    getSatisfyingVersion,
    minSatisfyingVersion,
    sortVersions,
};
exports.default = exports.api;
//# sourceMappingURL=index.js.map