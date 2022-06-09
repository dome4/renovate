"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = exports.supportsRanges = exports.urls = exports.displayName = exports.id = void 0;
const regex_1 = require("../../../util/regex");
const generic_1 = require("../generic");
exports.id = 'docker';
exports.displayName = 'Docker';
exports.urls = [
    'https://docs.docker.com/engine/reference/commandline/tag/',
];
exports.supportsRanges = false;
const versionPattern = (0, regex_1.regEx)(/^(?<version>\d+(?:\.\d+)*)(?<prerelease>.*)$/);
const commitHashPattern = (0, regex_1.regEx)(/^[a-f0-9]{7,40}$/);
const numericPattern = (0, regex_1.regEx)(/^[0-9]+$/);
class DockerVersioningApi extends generic_1.GenericVersioningApi {
    _parse(version) {
        if (!version) {
            return null;
        }
        if (commitHashPattern.test(version) && !numericPattern.test(version)) {
            return null;
        }
        const versionPieces = version.replace((0, regex_1.regEx)(/^v/), '').split('-');
        const [prefix, ...suffixPieces] = versionPieces;
        const matchGroups = prefix?.match(versionPattern)?.groups;
        if (!matchGroups) {
            return null;
        }
        const { version: ver, prerelease } = matchGroups;
        const release = ver.split('.').map(Number);
        return { release, suffix: suffixPieces.join('-'), prerelease };
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
            // shorter is bigger 2.1 > 2.1.1
            if (part1 === undefined) {
                return 1;
            }
            if (part2 === undefined) {
                return -1;
            }
            if (part1 !== part2) {
                return part1 - part2;
            }
        }
        if (parsed1.prerelease !== parsed2.prerelease) {
            // unstable is lower
            if (!parsed1.prerelease && parsed2.prerelease) {
                return 1;
            }
            if (parsed1.prerelease && !parsed2.prerelease) {
                return -1;
            }
            // alphabetic order
            if (parsed1.prerelease && parsed2.prerelease) {
                return parsed1.prerelease.localeCompare(parsed2.prerelease);
            }
        }
        // equals
        const suffix1 = parsed1.suffix ?? '';
        const suffix2 = parsed2.suffix ?? '';
        return suffix2.localeCompare(suffix1);
    }
    isCompatible(version, current) {
        const parsed1 = this._parse(version);
        const parsed2 = this._parse(current);
        return !!(parsed1 &&
            parsed2 &&
            parsed1.suffix === parsed2.suffix &&
            parsed1.release.length === parsed2.release.length);
    }
    valueToVersion(value) {
        // Remove any suffix after '-', e.g. '-alpine'
        return value ? value.split('-')[0] : value;
    }
}
exports.api = new DockerVersioningApi();
exports.default = exports.api;
//# sourceMappingURL=index.js.map