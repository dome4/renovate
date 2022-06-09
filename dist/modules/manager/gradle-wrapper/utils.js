"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractGradleVersion = exports.getJavaVersioning = exports.getJavaContraint = exports.prepareGradleCommand = exports.gradleWrapperFileName = exports.extraEnv = void 0;
const tslib_1 = require("tslib");
const os_1 = tslib_1.__importDefault(require("os"));
const upath_1 = tslib_1.__importDefault(require("upath"));
const global_1 = require("../../../config/global");
const logger_1 = require("../../../logger");
const fs_1 = require("../../../util/fs");
const regex_1 = require("../../../util/regex");
const gradle_1 = tslib_1.__importDefault(require("../../versioning/gradle"));
const npm_1 = require("../../versioning/npm");
exports.extraEnv = {
    GRADLE_OPTS: '-Dorg.gradle.parallel=true -Dorg.gradle.configureondemand=true -Dorg.gradle.daemon=false -Dorg.gradle.caching=false',
};
// istanbul ignore next
function gradleWrapperFileName() {
    if (os_1.default.platform() === 'win32' &&
        global_1.GlobalConfig.get('binarySource') !== 'docker') {
        return 'gradlew.bat';
    }
    return './gradlew';
}
exports.gradleWrapperFileName = gradleWrapperFileName;
async function prepareGradleCommand(gradlewName, cwd, gradlew, args) {
    // istanbul ignore if
    if (gradlew?.isFile() === true) {
        // if the file is not executable by others
        if ((gradlew.mode & 0o1) === 0) {
            // add the execution permission to the owner, group and others
            await (0, fs_1.chmod)(upath_1.default.join(cwd, gradlewName), gradlew.mode | 0o111);
        }
        if (args === null) {
            return gradlewName;
        }
        return `${gradlewName} ${args}`;
    }
    /* eslint-enable no-bitwise */
    return null;
}
exports.prepareGradleCommand = prepareGradleCommand;
/**
 * Find compatible java version for gradle.
 * see https://docs.gradle.org/current/userguide/compatibility.html
 * @param gradleVersion current gradle version
 * @returns A Java semver range
 */
function getJavaContraint(gradleVersion) {
    if (global_1.GlobalConfig.get('binarySource') !== 'docker') {
        // ignore
        return null;
    }
    const major = gradle_1.default.getMajor(gradleVersion);
    if (major && major >= 7) {
        return '^16.0.0';
    }
    // first public gradle version was 2.0
    if (major && major > 0 && major < 5) {
        return '^8.0.0';
    }
    return '^11.0.0';
}
exports.getJavaContraint = getJavaContraint;
function getJavaVersioning() {
    return npm_1.id;
}
exports.getJavaVersioning = getJavaVersioning;
// https://regex101.com/r/IcOs7P/1
const DISTRIBUTION_URL_REGEX = (0, regex_1.regEx)('^(?:distributionUrl\\s*=\\s*)(?<url>\\S*-(?<version>\\d+\\.\\d+(?:\\.\\d+)?(?:-\\w+)*)-(?<type>bin|all)\\.zip)\\s*$');
function extractGradleVersion(fileContent) {
    const lines = fileContent?.split(regex_1.newlineRegex) ?? [];
    for (const line of lines) {
        const distributionUrlMatch = DISTRIBUTION_URL_REGEX.exec(line);
        if (distributionUrlMatch?.groups) {
            return {
                url: distributionUrlMatch.groups.url,
                version: distributionUrlMatch.groups.version,
            };
        }
    }
    logger_1.logger.debug('Gradle wrapper version and url could not be extracted from properties - skipping update');
    return null;
}
exports.extractGradleVersion = extractGradleVersion;
//# sourceMappingURL=utils.js.map