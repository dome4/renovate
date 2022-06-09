"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bumpPackageVersion = void 0;
const tslib_1 = require("tslib");
const semver_1 = tslib_1.__importDefault(require("semver"));
const logger_1 = require("../../../../../logger");
const regex_1 = require("../../../../../util/regex");
function bumpPackageVersion(content, currentValue, bumpVersion) {
    logger_1.logger.debug({ bumpVersion, currentValue }, 'Checking if we should bump package.json version');
    let newPjVersion;
    let bumpedContent = content;
    try {
        if (bumpVersion.startsWith('mirror:')) {
            const mirrorPackage = bumpVersion.replace('mirror:', '');
            const parsedContent = JSON.parse(content);
            newPjVersion =
                parsedContent.dependencies?.[mirrorPackage] ??
                    parsedContent.devDependencies?.[mirrorPackage] ??
                    parsedContent.optionalDependencies?.[mirrorPackage] ??
                    parsedContent.peerDependencies?.[mirrorPackage];
            if (!newPjVersion) {
                logger_1.logger.warn('bumpVersion mirror package not found: ' + mirrorPackage);
                return { bumpedContent };
            }
        }
        else {
            newPjVersion = semver_1.default.inc(currentValue, bumpVersion);
        }
        logger_1.logger.debug({ newPjVersion });
        bumpedContent = content.replace((0, regex_1.regEx)(`(?<version>"version":\\s*")[^"]*`), `$<version>${newPjVersion}`);
        if (bumpedContent === content) {
            logger_1.logger.debug('Version was already bumped');
        }
        else {
            logger_1.logger.debug('Bumped package.json version');
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
//# sourceMappingURL=index.js.map