"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bumpPackageVersion = void 0;
const tslib_1 = require("tslib");
const semver_1 = tslib_1.__importDefault(require("semver"));
const logger_1 = require("../../../logger");
const regex_1 = require("../../../util/regex");
function bumpPackageVersion(content, currentValue, bumpVersion) {
    logger_1.logger.debug({ bumpVersion, currentValue }, 'Checking if we should bump Chart.yaml version');
    let newChartVersion;
    let bumpedContent = content;
    try {
        newChartVersion = semver_1.default.inc(currentValue, bumpVersion);
        if (!newChartVersion) {
            throw new Error('semver inc failed');
        }
        logger_1.logger.debug({ newChartVersion });
        bumpedContent = content.replace((0, regex_1.regEx)(`^(?<version>version:\\s*).*$`, 'm'), `$<version>${newChartVersion}`);
        if (bumpedContent === content) {
            logger_1.logger.debug('Version was already bumped');
        }
        else {
            logger_1.logger.debug('Bumped Chart.yaml version');
        }
    }
    catch (err) {
        logger_1.logger.warn({
            content,
            currentValue,
            bumpVersion,
        }, 'Failed to bumpVersion');
    }
    return { bumpedContent };
}
exports.bumpPackageVersion = bumpPackageVersion;
//# sourceMappingURL=update.js.map