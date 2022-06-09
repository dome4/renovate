"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = exports.supportedRangeStrategies = exports.supportsRanges = exports.urls = exports.displayName = exports.id = void 0;
const regex_1 = require("../../../util/regex");
const compare_1 = require("./compare");
exports.id = 'gradle';
exports.displayName = 'Gradle';
exports.urls = [
    'https://docs.gradle.org/current/userguide/single_versions.html#version_ordering',
];
exports.supportsRanges = true;
exports.supportedRangeStrategies = ['pin'];
const equals = (a, b) => (0, compare_1.compare)(a, b) === 0;
const getMajor = (version) => {
    const tokens = (0, compare_1.parse)(version?.replace((0, regex_1.regEx)(/^v/i), ''));
    if (tokens) {
        const majorToken = tokens?.[0];
        if (majorToken && majorToken.type === compare_1.TokenType.Number) {
            return majorToken.val;
        }
    }
    return null;
};
const getMinor = (version) => {
    const tokens = (0, compare_1.parse)(version?.replace((0, regex_1.regEx)(/^v/i), ''));
    if (tokens) {
        const majorToken = tokens[0];
        const minorToken = tokens[1];
        if (majorToken &&
            majorToken.type === compare_1.TokenType.Number &&
            minorToken &&
            minorToken.type === compare_1.TokenType.Number) {
            return minorToken.val;
        }
        return 0;
    }
    return null;
};
const getPatch = (version) => {
    const tokens = (0, compare_1.parse)(version?.replace((0, regex_1.regEx)(/^v/i), ''));
    if (tokens) {
        const majorToken = tokens[0];
        const minorToken = tokens[1];
        const patchToken = tokens[2];
        if (majorToken &&
            majorToken.type === compare_1.TokenType.Number &&
            minorToken &&
            minorToken.type === compare_1.TokenType.Number &&
            patchToken &&
            patchToken.type === compare_1.TokenType.Number) {
            return patchToken.val;
        }
        return 0;
    }
    return null;
};
const isGreaterThan = (a, b) => (0, compare_1.compare)(a, b) === 1;
const unstable = new Set([
    'a',
    'alpha',
    'b',
    'beta',
    'm',
    'mt',
    'milestone',
    'rc',
    'cr',
    'preview',
    'snapshot',
]);
const isStable = (version) => {
    const tokens = (0, compare_1.parse)(version);
    if (tokens) {
        for (const token of tokens) {
            if (token.type === compare_1.TokenType.String) {
                const val = token.val.toString().toLowerCase();
                if (unstable.has(val)) {
                    return false;
                }
            }
        }
        return true;
    }
    return false;
};
const matches = (a, b) => {
    const versionTokens = (0, compare_1.parse)(a);
    if (!a || !versionTokens || !b) {
        return false;
    }
    if ((0, compare_1.isVersion)(b)) {
        return equals(a, b);
    }
    const prefixRange = (0, compare_1.parsePrefixRange)(b);
    if (prefixRange) {
        const tokens = prefixRange.tokens;
        if (tokens.length === 0) {
            return true;
        }
        const x = versionTokens
            .slice(0, tokens.length)
            .map(({ val }) => val)
            .join('.');
        const y = tokens.map(({ val }) => val).join('.');
        return equals(x, y);
    }
    const mavenBasedRange = (0, compare_1.parseMavenBasedRange)(b);
    if (!mavenBasedRange) {
        return false;
    }
    const { leftBound, leftVal, rightBound, rightVal } = mavenBasedRange;
    let leftResult = true;
    let rightResult = true;
    if (leftVal) {
        leftResult =
            leftBound === compare_1.RangeBound.Exclusive
                ? (0, compare_1.compare)(leftVal, a) === -1
                : (0, compare_1.compare)(leftVal, a) !== 1;
    }
    if (rightVal) {
        rightResult =
            rightBound === compare_1.RangeBound.Exclusive
                ? (0, compare_1.compare)(a, rightVal) === -1
                : (0, compare_1.compare)(a, rightVal) !== 1;
    }
    return leftResult && rightResult;
};
function getSatisfyingVersion(versions, range) {
    return versions.reduce((result, version) => {
        if (matches(version, range)) {
            if (!result) {
                return version;
            }
            if (isGreaterThan(version, result)) {
                return version;
            }
        }
        return result;
    }, null);
}
function minSatisfyingVersion(versions, range) {
    return versions.reduce((result, version) => {
        if (matches(version, range)) {
            if (!result) {
                return version;
            }
            if ((0, compare_1.compare)(version, result) === -1) {
                return version;
            }
        }
        return result;
    }, null);
}
function getNewValue({ currentValue, rangeStrategy, newVersion, }) {
    if ((0, compare_1.isVersion)(currentValue) || rangeStrategy === 'pin') {
        return newVersion;
    }
    return null;
}
exports.api = {
    equals,
    getMajor,
    getMinor,
    getPatch,
    isCompatible: compare_1.isVersion,
    isGreaterThan,
    isSingleVersion: compare_1.isVersion,
    isStable,
    isValid: compare_1.isValid,
    isVersion: compare_1.isVersion,
    matches,
    getSatisfyingVersion,
    minSatisfyingVersion,
    getNewValue,
    sortVersions: compare_1.compare,
};
exports.default = exports.api;
//# sourceMappingURL=index.js.map