"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = exports.isValid = exports.supportedRangeStrategies = exports.supportsRanges = exports.urls = exports.displayName = exports.id = void 0;
const regex_1 = require("../../../util/regex");
const npm_1 = require("../npm");
const pep440_1 = require("../pep440");
const pattern_1 = require("./pattern");
const transform_1 = require("./transform");
exports.id = 'rez';
exports.displayName = 'rez';
exports.urls = ['https://github.com/nerdvegas/rez'];
exports.supportsRanges = true;
exports.supportedRangeStrategies = [
    'bump',
    'widen',
    'pin',
    'replace',
];
function equals(a, b) {
    try {
        return npm_1.api.equals((0, transform_1.padZeroes)(a), (0, transform_1.padZeroes)(b));
    }
    catch (err) /* istanbul ignore next */ {
        return pep440_1.api.equals(a, b);
    }
}
function getMajor(version) {
    try {
        return npm_1.api.getMajor((0, transform_1.padZeroes)(version));
    }
    catch (err) /* istanbul ignore next */ {
        return pep440_1.api.getMajor(version);
    }
}
function getMinor(version) {
    try {
        return npm_1.api.getMinor((0, transform_1.padZeroes)(version));
    }
    catch (err) /* istanbul ignore next */ {
        return pep440_1.api.getMinor(version);
    }
}
function getPatch(version) {
    try {
        return npm_1.api.getPatch((0, transform_1.padZeroes)(version));
    }
    catch (err) /* istanbul ignore next */ {
        return pep440_1.api.getPatch(version);
    }
}
function isGreaterThan(a, b) {
    try {
        return npm_1.api.isGreaterThan((0, transform_1.padZeroes)(a), (0, transform_1.padZeroes)(b));
    }
    catch (err) /* istanbul ignore next */ {
        return pep440_1.api.isGreaterThan(a, b);
    }
}
function isLessThanRange(version, range) {
    return (npm_1.api.isVersion((0, transform_1.padZeroes)(version)) &&
        !!npm_1.api.isLessThanRange?.((0, transform_1.padZeroes)(version), (0, transform_1.rez2npm)(range)));
}
function isValid(input) {
    return npm_1.api.isValid((0, transform_1.rez2npm)(input));
}
exports.isValid = isValid;
function isStable(version) {
    return npm_1.api.isStable((0, transform_1.padZeroes)(version));
}
function isVersion(input) {
    return npm_1.api.isVersion((0, transform_1.padZeroes)((0, transform_1.rez2npm)(input)));
}
function matches(version, range) {
    return (npm_1.api.isVersion((0, transform_1.padZeroes)(version)) &&
        npm_1.api.matches((0, transform_1.padZeroes)(version), (0, transform_1.rez2npm)(range)));
}
function getSatisfyingVersion(versions, range) {
    return npm_1.api.getSatisfyingVersion(versions, (0, transform_1.rez2npm)(range));
}
function minSatisfyingVersion(versions, range) {
    return npm_1.api.minSatisfyingVersion(versions, (0, transform_1.rez2npm)(range));
}
function isSingleVersion(constraint) {
    return ((constraint.trim().startsWith('==') &&
        isVersion(constraint.trim().substring(2).trim())) ||
        isVersion(constraint.trim()));
}
function sortVersions(a, b) {
    return npm_1.api.sortVersions((0, transform_1.padZeroes)(a), (0, transform_1.padZeroes)(b));
}
function getNewValue({ currentValue, rangeStrategy, currentVersion, newVersion, }) {
    const pep440Value = pep440_1.api.getNewValue({
        currentValue: (0, transform_1.rez2pep440)(currentValue),
        rangeStrategy,
        currentVersion,
        newVersion,
    });
    if (pattern_1.exactVersion.test(currentValue)) {
        return pep440Value;
    }
    if (pep440Value && pattern_1.inclusiveBound.test(currentValue)) {
        return (0, transform_1.pep4402rezInclusiveBound)(pep440Value);
    }
    if (pep440Value && pattern_1.lowerBound.test(currentValue)) {
        if (currentValue.includes('+')) {
            return (0, transform_1.npm2rezplus)(pep440Value);
        }
        return pep440Value;
    }
    if (pep440Value && pattern_1.upperBound.test(currentValue)) {
        return pep440Value;
    }
    const matchAscRange = pattern_1.ascendingRange.exec(currentValue);
    if (pep440Value && matchAscRange?.groups) {
        // Replace version numbers but keep rez format, otherwise we just end up trying
        // to convert every single case separately.
        const lowerBoundAscCurrent = matchAscRange.groups.range_lower_asc;
        const upperBoundAscCurrent = matchAscRange.groups.range_upper_asc;
        const lowerAscVersionCurrent = matchAscRange.groups.range_lower_asc_version;
        const upperAscVersionCurrent = matchAscRange.groups.range_upper_asc_version;
        const [lowerBoundAscPep440, upperBoundAscPep440] = pep440Value.split(', ');
        const lowerAscVersionNew = (0, regex_1.regEx)(pattern_1.versionGroup).exec(lowerBoundAscPep440)?.[0] ?? '';
        const upperAscVersionNew = (0, regex_1.regEx)(pattern_1.versionGroup).exec(upperBoundAscPep440)?.[0] ?? '';
        const lowerBoundAscNew = lowerBoundAscCurrent.replace(lowerAscVersionCurrent, lowerAscVersionNew);
        const upperBoundAscNew = upperBoundAscCurrent.replace(upperAscVersionCurrent, upperAscVersionNew);
        const separator = currentValue.includes(',') ? ',' : '';
        return lowerBoundAscNew + separator + upperBoundAscNew;
    }
    const matchDscRange = pattern_1.descendingRange.exec(currentValue);
    if (pep440Value && matchDscRange?.groups) {
        // Replace version numbers but keep rez format, otherwise we just end up trying
        // to convert every single case separately.
        const upperBoundDescCurrent = matchDscRange.groups.range_upper_desc;
        const lowerBoundDescCurrent = matchDscRange.groups.range_lower_desc;
        const upperDescVersionCurrent = matchDscRange.groups.range_upper_desc_version;
        const lowerDescVersionCurrent = matchDscRange.groups.range_lower_desc_version;
        const [lowerBoundDescPep440, upperBoundDescPep440] = pep440Value.split(', ');
        const upperDescVersionNew = (0, regex_1.regEx)(pattern_1.versionGroup).exec(upperBoundDescPep440)?.[0] ?? '';
        const lowerDescVersionNew = (0, regex_1.regEx)(pattern_1.versionGroup).exec(lowerBoundDescPep440)?.[0] ?? '';
        const upperBoundDescNew = upperBoundDescCurrent.replace(upperDescVersionCurrent, upperDescVersionNew);
        const lowerBoundDescNew = lowerBoundDescCurrent.replace(lowerDescVersionCurrent, lowerDescVersionNew);
        // Descending ranges are only supported with a comma.
        const separator = ',';
        return upperBoundDescNew + separator + lowerBoundDescNew;
    }
    return null;
}
function isCompatible(version) {
    return isVersion(version);
}
exports.api = {
    equals,
    getMajor,
    getMinor,
    getPatch,
    getNewValue,
    getSatisfyingVersion,
    isCompatible,
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