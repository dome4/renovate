"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = exports.sortVersions = exports.matches = exports.isValid = exports.isVersion = exports.supportedRangeStrategies = exports.supportsRanges = exports.urls = exports.displayName = exports.id = void 0;
const ruby_semver_1 = require("@renovatebot/ruby-semver");
const logger_1 = require("../../../logger");
const regex_1 = require("../../../util/regex");
const operator_1 = require("./operator");
const range_1 = require("./range");
const strategies_1 = require("./strategies");
const version_1 = require("./version");
exports.id = 'ruby';
exports.displayName = 'Ruby';
exports.urls = [
    'https://guides.rubygems.org/patterns/',
    'https://bundler.io/v1.5/gemfile.html',
    'https://www.devalot.com/articles/2012/04/gem-versions.html',
];
exports.supportsRanges = true;
exports.supportedRangeStrategies = [
    'bump',
    'widen',
    'pin',
    'replace',
];
function vtrim(version) {
    if (typeof version === 'string') {
        return version.replace((0, regex_1.regEx)(/^v/), '').replace((0, regex_1.regEx)(/('|")/g), '');
    }
    return version;
}
const equals = (left, right) => (0, ruby_semver_1.eq)(vtrim(left), vtrim(right));
const getMajor = (version) => (0, version_1.parse)(vtrim(version)).major;
const getMinor = (version) => (0, version_1.parse)(vtrim(version)).minor;
const getPatch = (version) => (0, version_1.parse)(vtrim(version)).patch;
const isVersion = (version) => !!(0, ruby_semver_1.valid)(vtrim(version));
exports.isVersion = isVersion;
const isGreaterThan = (left, right) => (0, ruby_semver_1.gt)(vtrim(left), vtrim(right));
const isLessThanRange = (version, range) => !!(0, range_1.ltr)(vtrim(version), vtrim(range));
const isSingleVersion = (range) => {
    const { version, operator } = (0, range_1.parse)(vtrim(range));
    return operator
        ? (0, exports.isVersion)(version) && (0, operator_1.isSingleOperator)(operator)
        : (0, exports.isVersion)(version);
};
function isStable(version) {
    const v = vtrim(version);
    return (0, version_1.parse)(v).prerelease ? false : (0, exports.isVersion)(v);
}
const isValid = (input) => input
    .split(',')
    .map((piece) => vtrim(piece.trim()))
    .every((range) => {
    const { version, operator } = (0, range_1.parse)(range);
    return operator
        ? (0, exports.isVersion)(version) && (0, operator_1.isValidOperator)(operator)
        : (0, exports.isVersion)(version);
});
exports.isValid = isValid;
const matches = (version, range) => (0, ruby_semver_1.satisfies)(vtrim(version), vtrim(range));
exports.matches = matches;
function getSatisfyingVersion(versions, range) {
    return (0, ruby_semver_1.maxSatisfying)(versions.map(vtrim), vtrim(range));
}
function minSatisfyingVersion(versions, range) {
    return (0, ruby_semver_1.minSatisfying)(versions.map(vtrim), vtrim(range));
}
const getNewValue = ({ currentValue, rangeStrategy, currentVersion, newVersion, }) => {
    let newValue = null;
    if ((0, exports.isVersion)(currentValue)) {
        newValue = currentValue.startsWith('v') ? 'v' + newVersion : newVersion;
    }
    else if (currentValue.replace((0, regex_1.regEx)(/^=\s*/), '') === currentVersion) {
        newValue = currentValue.replace(currentVersion, newVersion);
    }
    else {
        switch (rangeStrategy) {
            case 'update-lockfile':
                if ((0, ruby_semver_1.satisfies)(newVersion, currentValue)) {
                    newValue = currentValue;
                }
                else {
                    newValue = getNewValue({
                        currentValue,
                        rangeStrategy: 'replace',
                        currentVersion,
                        newVersion,
                    });
                }
                break;
            case 'pin':
                newValue = (0, strategies_1.pin)({ to: vtrim(newVersion) });
                break;
            case 'bump':
                newValue = (0, strategies_1.bump)({ range: vtrim(currentValue), to: vtrim(newVersion) });
                break;
            case 'auto':
            case 'widen':
            case 'replace':
                newValue = (0, strategies_1.replace)({
                    range: vtrim(currentValue),
                    to: vtrim(newVersion),
                });
                break;
            // istanbul ignore next
            default:
                logger_1.logger.warn(`Unsupported strategy ${rangeStrategy}`);
        }
    }
    if (newValue && (0, regex_1.regEx)(/^('|")/).exec(currentValue)) {
        const delimiter = currentValue[0];
        return newValue
            .split(',')
            .map((element) => element.replace((0, regex_1.regEx)(`^(?<whitespace>\\s*)`), `$<whitespace>${delimiter}`))
            .map((element) => element.replace(/(?<whitespace>\s*)$/, `${delimiter}$<whitespace>`) // TODO #12875 adds ' at front when re2 is used
        )
            .join(',');
    }
    return newValue;
};
const sortVersions = (left, right) => (0, ruby_semver_1.gt)(vtrim(left), vtrim(right)) ? 1 : -1;
exports.sortVersions = sortVersions;
exports.api = {
    equals,
    getMajor,
    getMinor,
    getPatch,
    isCompatible: exports.isVersion,
    isGreaterThan,
    isLessThanRange,
    isSingleVersion,
    isStable,
    isValid: exports.isValid,
    isVersion: exports.isVersion,
    matches: exports.matches,
    getSatisfyingVersion,
    minSatisfyingVersion,
    getNewValue,
    sortVersions: exports.sortVersions,
};
exports.default = exports.api;
//# sourceMappingURL=index.js.map