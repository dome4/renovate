"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = exports.isValid = exports.supportedRangeStrategies = exports.supportsRanges = exports.urls = exports.displayName = exports.id = void 0;
const regex_1 = require("../../../util/regex");
const npm_1 = require("../npm");
exports.id = 'hex';
exports.displayName = 'Hex';
exports.urls = ['https://hexdocs.pm/elixir/Version.html'];
exports.supportsRanges = true;
exports.supportedRangeStrategies = [
    'bump',
    'widen',
    'pin',
    'replace',
];
function hex2npm(input) {
    return input
        .replace((0, regex_1.regEx)(/~>\s*(\d+\.\d+)$/), '^$1')
        .replace((0, regex_1.regEx)(/~>\s*(\d+\.\d+\.\d+)/), '~$1')
        .replace((0, regex_1.regEx)(/==|and/), '')
        .replace('or', '||')
        .replace((0, regex_1.regEx)(/!=\s*(\d+\.\d+(\.\d+.*)?)/), '>$1 <$1')
        .trim();
}
function npm2hex(input) {
    const res = input
        .split(' ')
        .map((str) => str.trim())
        .filter((str) => str !== '');
    let output = '';
    const operators = ['^', '=', '>', '<', '<=', '>=', '~'];
    for (let i = 0; i < res.length; i += 1) {
        if (i === res.length - 1) {
            output += res[i];
            break;
        }
        if (i < res.length - 1 && res[i + 1].includes('||')) {
            output += res[i] + ' or ';
            i += 1;
        }
        else if (operators.includes(res[i])) {
            output += res[i] + ' ';
        }
        else {
            output += res[i] + ' and ';
        }
    }
    return output;
}
function isLessThanRange(version, range) {
    return !!npm_1.api.isLessThanRange?.(hex2npm(version), hex2npm(range));
}
const isValid = (input) => !!npm_1.api.isValid(hex2npm(input));
exports.isValid = isValid;
const matches = (version, range) => npm_1.api.matches(hex2npm(version), hex2npm(range));
function getSatisfyingVersion(versions, range) {
    return npm_1.api.getSatisfyingVersion(versions.map(hex2npm), hex2npm(range));
}
function minSatisfyingVersion(versions, range) {
    return npm_1.api.minSatisfyingVersion(versions.map(hex2npm), hex2npm(range));
}
function getNewValue({ currentValue, rangeStrategy, currentVersion, newVersion, }) {
    let newSemver = npm_1.api.getNewValue({
        currentValue: hex2npm(currentValue),
        rangeStrategy,
        currentVersion,
        newVersion,
    });
    if (newSemver) {
        newSemver = npm2hex(newSemver);
        if ((0, regex_1.regEx)(/~>\s*(\d+\.\d+\.\d+)$/).test(currentValue)) {
            newSemver = newSemver.replace((0, regex_1.regEx)(/[\^~]\s*(\d+\.\d+\.\d+)/), (_str, p1) => `~> ${p1}`);
        }
        else if ((0, regex_1.regEx)(/~>\s*(\d+\.\d+)$/).test(currentValue)) {
            newSemver = newSemver.replace((0, regex_1.regEx)(/\^\s*(\d+\.\d+)(\.\d+)?/), (_str, p1) => `~> ${p1}`);
        }
        else {
            newSemver = newSemver.replace((0, regex_1.regEx)(/~\s*(\d+\.\d+\.\d)/), '~> $1');
        }
        if (npm_1.api.isVersion(newSemver)) {
            newSemver = `== ${newSemver}`;
        }
    }
    return newSemver;
}
exports.api = {
    ...npm_1.api,
    isLessThanRange,
    isValid,
    matches,
    getSatisfyingVersion,
    minSatisfyingVersion,
    getNewValue,
};
exports.default = exports.api;
//# sourceMappingURL=index.js.map