"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RollingReleasesData = void 0;
const luxon_1 = require("luxon");
const logger_1 = require("../../../logger");
const refreshInterval = { days: 1 };
class RollingReleasesData {
    constructor(distroInfo) {
        this.ltsToVer = new Map();
        this.verToLts = new Map();
        this.timestamp = luxon_1.DateTime.fromMillis(0).toUTC(); // start of epoch
        this.distroInfo = distroInfo;
    }
    getVersionByLts(input) {
        this.build();
        const schedule = this.ltsToVer.get(input);
        if (schedule) {
            return schedule.version;
        }
        return input;
    }
    getLtsByVersion(input) {
        this.build();
        const di = this.verToLts.get(input);
        if (di) {
            return di.series;
        }
        return input;
    }
    has(version) {
        this.build();
        return this.ltsToVer.has(version);
    }
    schedule(version) {
        this.build();
        let schedule = undefined;
        if (this.verToLts.has(version)) {
            schedule = this.verToLts.get(version);
        }
        if (this.ltsToVer.has(version)) {
            schedule = this.ltsToVer.get(version);
        }
        return schedule;
    }
    build() {
        const now = luxon_1.DateTime.now().toUTC();
        if (now < this.timestamp.plus(refreshInterval)) {
            return;
        }
        logger_1.logger.debug('RollingReleasesData - data written');
        this.timestamp = now;
        for (let i = 0; i < 3; i++) {
            const di = this.distroInfo.getNLatest(i);
            // istanbul ignore if: should never happen
            if (!di) {
                return;
            }
            let prefix = '';
            for (let j = 0; j < i; j++) {
                prefix += 'old';
            }
            di.series = prefix + 'stable';
            this.ltsToVer.set(di.series, di);
            this.verToLts.set(di.version, di);
        }
    }
}
exports.RollingReleasesData = RollingReleasesData;
//# sourceMappingURL=common.js.map