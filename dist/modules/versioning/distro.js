"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DistroInfo = void 0;
const tslib_1 = require("tslib");
const luxon_1 = require("luxon");
const data_files_generated_1 = tslib_1.__importDefault(require("../../data-files.generated"));
// Days to delay new releases
const delay = 1;
class DistroInfo {
    constructor(distroJsonKey) {
        this._codenameToVersion = new Map();
        this._sortedInfo = [];
        this._distroInfo = JSON.parse(data_files_generated_1.default.get(distroJsonKey).replace(/v([\d.]+)\b/gm, '$1'));
        for (const version of Object.keys(this._distroInfo)) {
            const schedule = this._distroInfo[version];
            this._codenameToVersion.set(schedule.series, { version, ...schedule });
        }
        const arr = Object.keys(this._distroInfo).sort((a, b) => parseFloat(a) - parseFloat(b));
        for (const v of arr) {
            const obj = { version: v, ...this._distroInfo[v.toString()] };
            if (!obj.release) {
                // istanbul ignore next
                continue;
            }
            this._sortedInfo.push(obj);
        }
    }
    /**
     * Check if input is a valid release codename
     * @param input A codename
     * @returns true if input is a codename, false otherwise
     */
    isCodename(input) {
        return this._codenameToVersion.has(input);
    }
    /**
     * Checks if given input string is a valid release version
     * @param input A codename/semVer
     * @returns true if release exists, false otherwise
     */
    exists(input) {
        const ver = this.getVersionByCodename(input);
        return !!this._distroInfo[ver];
    }
    /**
     * Get semVer representation of a given codename
     * @param input A codename
     * @returns A semVer if exists, otherwise input string is returned
     */
    getVersionByCodename(input) {
        const schedule = this._codenameToVersion.get(input);
        if (schedule) {
            return schedule.version;
        }
        return input;
    }
    /**
     * Get codename representation of a given semVer
     * @param input A semVer
     * @returns A codename if exists, otherwise input string is returned
     */
    getCodenameByVersion(input) {
        const di = this._distroInfo[input];
        if (di) {
            return di.series;
        }
        // istanbul ignore next
        return input;
    }
    /**
     * Get schedule of a given release
     * @param input A codename/semVer
     * @returns A schedule if available, otherwise undefined
     */
    getSchedule(input) {
        const ver = this.getVersionByCodename(input);
        return this._distroInfo[ver] ?? null;
    }
    /**
     * Check if a given release has passed its EOL
     * @param input A codename/semVer
     * @returns false if still supported, true otherwise
     */
    isEolLts(input) {
        const ver = this.getVersionByCodename(input);
        const schedule = this.getSchedule(ver);
        const endLts = schedule?.eol ?? null;
        let end = schedule?.eol_lts ?? null;
        // ubuntu: does not have eol_lts
        // debian: only "Stable" has no eol_lts, old and oldold has both
        if (!end) {
            end = endLts;
        }
        if (end) {
            const now = luxon_1.DateTime.now().toUTC();
            const eol = luxon_1.DateTime.fromISO(end, { zone: 'utc' });
            return eol < now;
        }
        // istanbul ignore next
        return true;
    }
    /**
     * Check if a given version has been released
     * @param input A codename/semVer
     * @returns false if unreleased or has no schedule, true otherwise
     */
    isReleased(input) {
        const ver = this.getVersionByCodename(input);
        const schedule = this.getSchedule(ver);
        if (!schedule) {
            return false;
        }
        const now = luxon_1.DateTime.now().minus({ day: delay }).toUTC();
        const release = luxon_1.DateTime.fromISO(schedule.release, { zone: 'utc' });
        return release < now;
    }
    /**
     * Get distro info for the release that has N other newer releases.
     * Example: n=0 corresponds to the latest available release, n=1 the release before, etc.
     * In Debian terms: N = 0 -> stable, N = 1 -> oldstable, N = 2 -> oldoldstalbe
     * @param n
     * @returns Distro info of the Nth latest release
     */
    getNLatest(n) {
        const len = this._sortedInfo.length - 1;
        let idx = -1;
        if (n < 0) {
            return null;
        }
        for (let i = len; i >= 0; i--) {
            if (this.isReleased(this._sortedInfo[i].version)) {
                // 'i' holds the latest released version index
                // compensate for the requested 'n'
                idx = i - Math.floor(n);
                break;
            }
        }
        if (idx > len || idx < 0) {
            return null;
        }
        return this._sortedInfo[idx];
    }
}
exports.DistroInfo = DistroInfo;
//# sourceMappingURL=distro.js.map