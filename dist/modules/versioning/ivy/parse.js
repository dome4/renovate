"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDynamicRevision = exports.REV_TYPE_RANGE = exports.REV_TYPE_SUBREV = exports.REV_TYPE_LATEST = exports.LATEST_REGEX = void 0;
const regex_1 = require("../../../util/regex");
const compare_1 = require("../maven/compare");
const REV_TYPE_LATEST = 'REV_TYPE_LATEST';
exports.REV_TYPE_LATEST = REV_TYPE_LATEST;
const REV_TYPE_SUBREV = 'REV_TYPE_SUBREVISION';
exports.REV_TYPE_SUBREV = REV_TYPE_SUBREV;
const REV_TYPE_RANGE = 'REV_TYPE_RANGE';
exports.REV_TYPE_RANGE = REV_TYPE_RANGE;
exports.LATEST_REGEX = (0, regex_1.regEx)(/^latest\.|^latest$/i);
function parseDynamicRevision(str) {
    if (!str) {
        return null;
    }
    if (exports.LATEST_REGEX.test(str)) {
        const value = str.replace(exports.LATEST_REGEX, '').toLowerCase() || '';
        return {
            type: REV_TYPE_LATEST,
            value: value === 'integration' ? '' : value,
        };
    }
    const SUBREV_REGEX = (0, regex_1.regEx)(/\.\+$/);
    if (str.endsWith('.+')) {
        const value = str.replace(SUBREV_REGEX, '');
        if ((0, compare_1.isSingleVersion)(value)) {
            return {
                type: REV_TYPE_SUBREV,
                value,
            };
        }
    }
    const range = (0, compare_1.parseRange)(str);
    if (range && range.length === 1) {
        const rangeValue = (0, compare_1.rangeToStr)(range);
        if (rangeValue) {
            return {
                type: REV_TYPE_RANGE,
                value: rangeValue,
            };
        }
    }
    return null;
}
exports.parseDynamicRevision = parseDynamicRevision;
//# sourceMappingURL=parse.js.map