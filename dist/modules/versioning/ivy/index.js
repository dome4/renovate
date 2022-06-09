"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = exports.supportedRangeStrategies = exports.supportsRanges = exports.urls = exports.displayName = exports.id = void 0;
const tslib_1 = require("tslib");
const maven_1 = tslib_1.__importDefault(require("../maven"));
const compare_1 = require("../maven/compare");
const parse_1 = require("./parse");
exports.id = 'ivy';
exports.displayName = 'Ivy';
exports.urls = ['https://ant.apache.org/ivy/'];
exports.supportsRanges = true;
exports.supportedRangeStrategies = [
    'bump',
    'widen',
    'pin',
    'replace',
];
// eslint-disable-next-line @typescript-eslint/unbound-method
const { equals, getMajor, getMinor, getPatch, isGreaterThan, isStable, matches: mavenMatches, sortVersions, } = maven_1.default;
function isValid(str) {
    if (!str) {
        return false;
    }
    return maven_1.default.isVersion(str) || !!(0, parse_1.parseDynamicRevision)(str);
}
function isVersion(str) {
    if (!str || parse_1.LATEST_REGEX.test(str)) {
        return false;
    }
    return maven_1.default.isVersion(str);
}
function matches(a, b) {
    if (!a || !b) {
        return false;
    }
    const dynamicRevision = (0, parse_1.parseDynamicRevision)(b);
    if (!dynamicRevision) {
        return equals(a, b);
    }
    const { type, value } = dynamicRevision;
    if (type === parse_1.REV_TYPE_LATEST) {
        if (!value) {
            return true;
        }
        const tokens = (0, compare_1.tokenize)(a);
        if (tokens.length) {
            const token = tokens[tokens.length - 1];
            if (token.type === compare_1.TYPE_QUALIFIER) {
                return token.val.toLowerCase() === value;
            }
        }
        return false;
    }
    if (type === parse_1.REV_TYPE_SUBREV) {
        return (0, compare_1.isSubversion)(value, a);
    }
    return mavenMatches(a, value);
}
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
function getNewValue({ currentValue, rangeStrategy, newVersion, }) {
    if (isVersion(currentValue) || rangeStrategy === 'pin') {
        return newVersion;
    }
    return (0, compare_1.autoExtendMavenRange)(currentValue, newVersion);
}
function isCompatible(version) {
    return isVersion(version);
}
function isSingleVersion(version) {
    return isVersion(version);
}
exports.api = {
    equals,
    getMajor,
    getMinor,
    getPatch,
    isCompatible,
    isGreaterThan,
    isSingleVersion,
    isStable,
    isValid,
    isVersion,
    matches,
    getSatisfyingVersion,
    minSatisfyingVersion: getSatisfyingVersion,
    getNewValue,
    sortVersions,
};
exports.default = exports.api;
//# sourceMappingURL=index.js.map