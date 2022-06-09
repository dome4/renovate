"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenericVersioningApi = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
class GenericVersioningApi {
    _getSection(version, index) {
        const parsed = this._parse(version);
        return parsed && parsed.release.length > index
            ? parsed.release[index]
            : null;
    }
    _compare(version, other) {
        const left = this._parse(version);
        const right = this._parse(other);
        // istanbul ignore if
        if (!(left && right)) {
            return 1;
        }
        // support variable length compare
        const length = Math.max(left.release.length, right.release.length);
        for (let i = 0; i < length; i += 1) {
            // 2.1 and 2.1.0 are equivalent
            const part1 = left.release[i] ?? 0;
            const part2 = right.release[i] ?? 0;
            if (part1 !== part2) {
                return part1 - part2;
            }
        }
        if (is_1.default.nonEmptyString(left.prerelease) &&
            is_1.default.nonEmptyString(right.prerelease)) {
            const pre = left.prerelease.localeCompare(right.prerelease);
            if (pre !== 0) {
                return pre;
            }
        }
        else if (is_1.default.nonEmptyString(left.prerelease)) {
            return -1;
        }
        else if (is_1.default.nonEmptyString(right.prerelease)) {
            return 1;
        }
        return this._compareOther(left, right);
    }
    /*
     * virtual
     */
    _compareOther(_left, _right) {
        return 0;
    }
    isValid(version) {
        return this._parse(version) !== null;
    }
    isCompatible(version, _current) {
        return this.isValid(version);
    }
    isStable(version) {
        const parsed = this._parse(version);
        return !!(parsed && !parsed.prerelease);
    }
    isSingleVersion(version) {
        return this.isValid(version);
    }
    isVersion(version) {
        return this.isValid(version);
    }
    getMajor(version) {
        return this._getSection(version, 0);
    }
    getMinor(version) {
        return this._getSection(version, 1);
    }
    getPatch(version) {
        return this._getSection(version, 2);
    }
    equals(version, other) {
        return this._compare(version, other) === 0;
    }
    isGreaterThan(version, other) {
        return this._compare(version, other) > 0;
    }
    isLessThanRange(version, range) {
        return this._compare(version, range) < 0;
    }
    getSatisfyingVersion(versions, range) {
        const result = versions.find((v) => this.equals(v, range));
        return result ?? null;
    }
    minSatisfyingVersion(versions, range) {
        const result = versions.find((v) => this.equals(v, range));
        return result ?? null;
    }
    getNewValue(newValueConfig) {
        const { newVersion } = newValueConfig || {};
        return newVersion;
    }
    sortVersions(version, other) {
        return this._compare(version, other);
    }
    matches(version, range) {
        return this.equals(version, range);
    }
}
exports.GenericVersioningApi = GenericVersioningApi;
//# sourceMappingURL=generic.js.map