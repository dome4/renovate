"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = exports.minSatisfyingVersion = exports.getSatisfyingVersion = exports.matches = exports.isStable = exports.isValid = exports.supportsRanges = exports.urls = exports.displayName = exports.id = void 0;
const tslib_1 = require("tslib");
const luxon_1 = require("luxon");
const semver_1 = require("semver");
const npm_1 = tslib_1.__importStar(require("../npm"));
const schedule_1 = require("./schedule");
exports.id = 'node';
exports.displayName = 'Node.js';
exports.urls = [];
exports.supportsRanges = false;
function normalizeValue(value) {
    const schedule = (0, schedule_1.findScheduleForCodename)(value);
    if (schedule) {
        const major = schedule.version.replace('v', '');
        return `^${major}`;
    }
    return value;
}
function getNewValue({ currentValue, rangeStrategy, currentVersion, newVersion, }) {
    // Try to use codename if the current value is a codename
    if (rangeStrategy !== 'pin' && (0, schedule_1.findScheduleForCodename)(currentValue)) {
        const newSchedule = (0, schedule_1.findScheduleForVersion)(newVersion);
        if (newSchedule?.codename) {
            return newSchedule.codename.toLowerCase();
        }
    }
    const res = npm_1.default.getNewValue({
        currentValue: normalizeValue(currentValue),
        rangeStrategy,
        currentVersion,
        newVersion,
    });
    if (res && (0, npm_1.isVersion)(res)) {
        // normalize out any 'v' prefix
        return (0, semver_1.valid)(res);
    }
    return res;
}
function isValid(version) {
    return npm_1.default.isValid(normalizeValue(version));
}
exports.isValid = isValid;
function isStable(version) {
    if (npm_1.default.isStable(version)) {
        const schedule = (0, schedule_1.findScheduleForVersion)(version);
        if (schedule?.lts) {
            // TODO: use the exact release that started LTS (#9716)
            return luxon_1.DateTime.local() > luxon_1.DateTime.fromISO(schedule.lts);
        }
    }
    return false;
}
exports.isStable = isStable;
function matches(version, range) {
    return npm_1.default.matches(version, normalizeValue(range));
}
exports.matches = matches;
function getSatisfyingVersion(versions, range) {
    return npm_1.default.getSatisfyingVersion(versions, normalizeValue(range));
}
exports.getSatisfyingVersion = getSatisfyingVersion;
function minSatisfyingVersion(versions, range) {
    return npm_1.default.minSatisfyingVersion(versions, normalizeValue(range));
}
exports.minSatisfyingVersion = minSatisfyingVersion;
exports.api = {
    ...npm_1.default,
    isStable,
    getNewValue,
    isValid,
    matches,
    getSatisfyingVersion,
    minSatisfyingVersion,
};
exports.default = exports.api;
//# sourceMappingURL=index.js.map