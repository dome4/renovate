"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = exports.supportsRanges = exports.urls = exports.displayName = exports.id = void 0;
const regex_1 = require("../../../util/regex");
const generic_1 = require("../generic");
exports.id = 'loose';
exports.displayName = 'Loose';
exports.urls = [];
exports.supportsRanges = false;
const versionPattern = (0, regex_1.regEx)(/^v?(\d+(?:\.\d+)*)(.*)$/);
const commitHashPattern = (0, regex_1.regEx)(/^[a-f0-9]{7,40}$/);
const numericPattern = (0, regex_1.regEx)(/^[0-9]+$/);
class LooseVersioningApi extends generic_1.GenericVersioningApi {
    _parse(version) {
        if (commitHashPattern.test(version) && !numericPattern.test(version)) {
            return null;
        }
        const matches = versionPattern.exec(version);
        if (!matches) {
            return null;
        }
        const [, prefix, suffix] = matches;
        const release = prefix.split('.').map(Number);
        if (release.length > 6) {
            return null;
        }
        return { release, suffix: suffix || '' };
    }
    _compare(version, other) {
        const parsed1 = this._parse(version);
        const parsed2 = this._parse(other);
        // istanbul ignore if
        if (!(parsed1 && parsed2)) {
            return 1;
        }
        const length = Math.max(parsed1.release.length, parsed2.release.length);
        for (let i = 0; i < length; i += 1) {
            const part1 = parsed1.release[i];
            const part2 = parsed2.release[i];
            // shorter is smaller 2.1 < 2.1.0
            if (part1 === undefined) {
                return -1;
            }
            if (part2 === undefined) {
                return 1;
            }
            if (part1 !== part2) {
                return part1 - part2;
            }
        }
        if (parsed1.suffix && parsed2.suffix) {
            return parsed1.suffix.localeCompare(parsed2.suffix);
        }
        if (parsed1.suffix) {
            return -1;
        }
        if (parsed2.suffix) {
            return 1;
        }
        // istanbul ignore next
        return 0;
    }
}
exports.api = new LooseVersioningApi();
exports.default = exports.api;
//# sourceMappingURL=index.js.map