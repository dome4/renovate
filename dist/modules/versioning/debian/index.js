"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = exports.DebianVersioningApi = exports.supportedRangeStrategies = exports.supportsRanges = exports.urls = exports.displayName = exports.id = void 0;
const distro_1 = require("../distro");
const generic_1 = require("../generic");
const common_1 = require("./common");
exports.id = 'debian';
exports.displayName = 'Debian';
exports.urls = [
    'https://debian.pages.debian.net/distro-info-data/debian.csv',
];
exports.supportsRanges = true;
exports.supportedRangeStrategies = ['pin'];
const RELEASE_PROP = 'release';
class DebianVersioningApi extends generic_1.GenericVersioningApi {
    constructor() {
        super();
        this._distroInfo = new distro_1.DistroInfo('data/debian-distro-info.json');
        this._rollingReleases = new common_1.RollingReleasesData(this._distroInfo);
    }
    isValid(version) {
        const isValid = super.isValid(version);
        const schedule = this._distroInfo.getSchedule(this._rollingReleases.getVersionByLts(version));
        return (isValid && schedule && RELEASE_PROP in schedule) ?? false;
    }
    isStable(version) {
        let ver;
        ver = this._rollingReleases.getVersionByLts(version);
        ver = this._distroInfo.getVersionByCodename(ver);
        return this._distroInfo.isReleased(ver) && !this._distroInfo.isEolLts(ver);
    }
    getNewValue({ currentValue, rangeStrategy, currentVersion, newVersion, }) {
        if (rangeStrategy === 'pin') {
            let newVer = newVersion;
            // convert newVersion to semVer
            if (this._distroInfo.isCodename(newVersion)) {
                newVer = this._distroInfo.getVersionByCodename(newVersion);
            }
            if (this._rollingReleases.has(newVersion)) {
                newVer = this._rollingReleases.getVersionByLts(newVersion);
            }
            // current value is codename or [oldold|old|]stable
            if (this._distroInfo.isCodename(currentValue) ||
                this._rollingReleases.has(currentValue)) {
                return newVer;
            }
        }
        // current value is [oldold|old|]stable
        if (this._rollingReleases.has(currentValue)) {
            return this._rollingReleases.getLtsByVersion(newVersion);
        }
        if (this._distroInfo.isCodename(currentValue)) {
            const di = this._rollingReleases.schedule(newVersion);
            let ver = newVersion;
            if (di) {
                ver = di.version;
            }
            return this._distroInfo.getCodenameByVersion(ver);
        }
        // newVersion is [oldold|old|]stable
        // current value is numeric
        if (this._rollingReleases.has(newVersion)) {
            return this._rollingReleases.schedule(newVersion)?.version ?? newVersion;
        }
        return this._distroInfo.getVersionByCodename(newVersion);
    }
    _parse(version) {
        let ver;
        ver = this._rollingReleases.getVersionByLts(version);
        ver = this._distroInfo.getVersionByCodename(ver);
        if (!this._distroInfo.exists(ver)) {
            return null;
        }
        return { release: ver.split('.').map(Number) };
    }
}
exports.DebianVersioningApi = DebianVersioningApi;
exports.api = new DebianVersioningApi();
exports.default = exports.api;
//# sourceMappingURL=index.js.map