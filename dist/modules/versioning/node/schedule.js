"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findScheduleForVersion = exports.findScheduleForCodename = void 0;
const tslib_1 = require("tslib");
const data_files_generated_1 = tslib_1.__importDefault(require("../../../data-files.generated"));
const semver_1 = tslib_1.__importDefault(require("../semver"));
const nodeSchedule = JSON.parse(data_files_generated_1.default.get('data/node-js-schedule.json'));
const nodeCodenames = new Map();
for (const version of Object.keys(nodeSchedule)) {
    const schedule = nodeSchedule[version];
    if (schedule.codename) {
        nodeCodenames.set(schedule.codename.toUpperCase(), {
            version: version,
            ...schedule,
        });
    }
}
function findScheduleForCodename(codename) {
    return nodeCodenames.get(codename?.toUpperCase()) || null;
}
exports.findScheduleForCodename = findScheduleForCodename;
function findScheduleForVersion(version) {
    const major = semver_1.default.getMajor(version);
    const schedule = nodeSchedule[`v${major}`];
    return schedule;
}
exports.findScheduleForVersion = findScheduleForVersion;
//# sourceMappingURL=schedule.js.map