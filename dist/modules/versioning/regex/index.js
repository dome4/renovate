"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = exports.RegExpVersioningApi = exports.supportsRanges = exports.urls = exports.displayName = exports.id = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const semver_1 = tslib_1.__importDefault(require("semver"));
const error_messages_1 = require("../../../constants/error-messages");
const regex_1 = require("../../../util/regex");
const generic_1 = require("../generic");
exports.id = 'regex';
exports.displayName = 'Regular Expression';
exports.urls = [];
exports.supportsRanges = false;
// convenience method for passing a Version object into any semver.* method.
function asSemver(version) {
    let vstring = `${version.release[0]}.${version.release[1]}.${version.release[2]}`;
    if (is_1.default.nonEmptyString(version.prerelease)) {
        vstring += `-${version.prerelease}`;
    }
    return vstring;
}
class RegExpVersioningApi extends generic_1.GenericVersioningApi {
    constructor(_new_config) {
        super();
        // config is expected to be overridden by a user-specified RegExp value
        // sample values:
        //
        // * emulates the "semver" configuration:
        //   RegExp('^(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)(-(?<prerelease>.*))?$')
        // * emulates the "docker" configuration:
        //   RegExp('^(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)(-(?<compatibility>.*))?$')
        // * matches the versioning approach used by the Python images on DockerHub:
        //   RegExp('^(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)(?<prerelease>[^.-]+)?(-(?<compatibility>.*))?$');
        // * matches the versioning approach used by the Bitnami images on DockerHub:
        //   RegExp('^(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)(:?-(?<compatibility>.*-r)(?<build>\\d+))?$');
        this._config = null;
        const new_config = _new_config ?? '^(?<major>\\d+)?$';
        // without at least one of {major, minor, patch} specified in the regex,
        // this versioner will not work properly
        if (!new_config.includes('<major>') &&
            !new_config.includes('<minor>') &&
            !new_config.includes('<patch>')) {
            const error = new Error(error_messages_1.CONFIG_VALIDATION);
            error.validationSource = new_config;
            error.validationError =
                'regex versioning needs at least one major, minor or patch group defined';
            throw error;
        }
        // TODO: should we validate the user has not added extra unsupported
        // capture groups? (#9717)
        this._config = (0, regex_1.regEx)(new_config);
    }
    // convenience method for passing a string into a Version given current config.
    _parse(version) {
        const groups = this._config?.exec(version)?.groups;
        if (!groups) {
            return null;
        }
        const { major, minor, patch, build, prerelease, compatibility } = groups;
        const release = [
            typeof major === 'undefined' ? 0 : Number.parseInt(major, 10),
            typeof minor === 'undefined' ? 0 : Number.parseInt(minor, 10),
            typeof patch === 'undefined' ? 0 : Number.parseInt(patch, 10),
        ];
        if (build) {
            release.push(Number.parseInt(build, 10));
        }
        return {
            release,
            prerelease: prerelease,
            compatibility: compatibility,
        };
    }
    isCompatible(version, current) {
        const parsedVersion = this._parse(version);
        const parsedCurrent = this._parse(current);
        return !!(parsedVersion &&
            parsedCurrent &&
            parsedVersion.compatibility === parsedCurrent.compatibility);
    }
    isLessThanRange(version, range) {
        const parsedVersion = this._parse(version);
        const parsedRange = this._parse(range);
        return !!(parsedVersion &&
            parsedRange &&
            semver_1.default.ltr(asSemver(parsedVersion), asSemver(parsedRange)));
    }
    getSatisfyingVersion(versions, range) {
        const parsedRange = this._parse(range);
        return parsedRange
            ? semver_1.default.maxSatisfying(versions
                .map((v) => this._parse(v))
                .filter(is_1.default.truthy)
                .map(asSemver), asSemver(parsedRange))
            : null;
    }
    minSatisfyingVersion(versions, range) {
        const parsedRange = this._parse(range);
        return parsedRange
            ? semver_1.default.minSatisfying(versions
                .map((v) => this._parse(v))
                .filter(is_1.default.truthy)
                .map(asSemver), asSemver(parsedRange))
            : null;
    }
    matches(version, range) {
        const parsedVersion = this._parse(version);
        const parsedRange = this._parse(range);
        return !!(parsedVersion &&
            parsedRange &&
            semver_1.default.satisfies(asSemver(parsedVersion), asSemver(parsedRange)));
    }
}
exports.RegExpVersioningApi = RegExpVersioningApi;
exports.api = RegExpVersioningApi;
exports.default = exports.api;
//# sourceMappingURL=index.js.map