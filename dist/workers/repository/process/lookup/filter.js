"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterVersions = void 0;
const tslib_1 = require("tslib");
const semver_1 = tslib_1.__importDefault(require("semver"));
const error_messages_1 = require("../../../../constants/error-messages");
const logger_1 = require("../../../../logger");
const npmVersioning = tslib_1.__importStar(require("../../../../modules/versioning/npm"));
const pep440 = tslib_1.__importStar(require("../../../../modules/versioning/pep440"));
const poetryVersioning = tslib_1.__importStar(require("../../../../modules/versioning/poetry"));
const regex_1 = require("../../../../util/regex");
function filterVersions(config, currentVersion, latestVersion, releases, versioning) {
    const { ignoreUnstable, ignoreDeprecated, respectLatest, allowedVersions } = config;
    function isVersionStable(version) {
        if (!versioning.isStable(version)) {
            return false;
        }
        // Check if the datasource returned isStable = false
        const release = releases.find((r) => r.version === version);
        if (release?.isStable === false) {
            return false;
        }
        return true;
    }
    // istanbul ignore if: shouldn't happen
    if (!currentVersion) {
        return [];
    }
    // Leave only versions greater than current
    let filteredVersions = releases.filter((v) => versioning.isVersion(v.version) &&
        versioning.isGreaterThan(v.version, currentVersion));
    // Don't upgrade from non-deprecated to deprecated
    const fromRelease = releases.find((release) => release.version === currentVersion);
    if (ignoreDeprecated && fromRelease && !fromRelease.isDeprecated) {
        filteredVersions = filteredVersions.filter((v) => {
            const versionRelease = releases.find((release) => release.version === v.version);
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            if (versionRelease.isDeprecated) {
                logger_1.logger.trace(`Skipping ${config.depName}@${v.version} because it is deprecated`);
                return false;
            }
            return true;
        });
    }
    if (allowedVersions) {
        const isAllowedPred = (0, regex_1.configRegexPredicate)(allowedVersions);
        if (isAllowedPred) {
            filteredVersions = filteredVersions.filter(({ version }) => isAllowedPred(version));
        }
        else if (versioning.isValid(allowedVersions)) {
            filteredVersions = filteredVersions.filter((v) => versioning.matches(v.version, allowedVersions));
        }
        else if (config.versioning !== npmVersioning.id &&
            semver_1.default.validRange(allowedVersions)) {
            logger_1.logger.debug({ depName: config.depName }, 'Falling back to npm semver syntax for allowedVersions');
            filteredVersions = filteredVersions.filter((v) => semver_1.default.satisfies(semver_1.default.coerce(v.version), allowedVersions));
        }
        else if (config.versioning === poetryVersioning.id &&
            pep440.isValid(allowedVersions)) {
            logger_1.logger.debug({ depName: config.depName }, 'Falling back to pypi syntax for allowedVersions');
            filteredVersions = filteredVersions.filter((v) => pep440.matches(v.version, allowedVersions));
        }
        else {
            const error = new Error(error_messages_1.CONFIG_VALIDATION);
            error.validationSource = 'config';
            error.validationError = 'Invalid `allowedVersions`';
            error.validationMessage =
                'The following allowedVersions does not parse as a valid version or range: ' +
                    JSON.stringify(allowedVersions);
            throw error;
        }
    }
    if (config.followTag) {
        return filteredVersions;
    }
    if (respectLatest &&
        latestVersion &&
        !versioning.isGreaterThan(currentVersion, latestVersion)) {
        filteredVersions = filteredVersions.filter((v) => !versioning.isGreaterThan(v.version, latestVersion));
    }
    if (!ignoreUnstable) {
        return filteredVersions;
    }
    if (isVersionStable(currentVersion)) {
        return filteredVersions.filter((v) => isVersionStable(v.version));
    }
    // if current is unstable then allow unstable in the current major only
    // Allow unstable only in current major
    return filteredVersions.filter((v) => isVersionStable(v.version) ||
        (versioning.getMajor(v.version) === versioning.getMajor(currentVersion) &&
            versioning.getMinor(v.version) ===
                versioning.getMinor(currentVersion) &&
            versioning.getPatch(v.version) === versioning.getPatch(currentVersion)));
}
exports.filterVersions = filterVersions;
//# sourceMappingURL=filter.js.map