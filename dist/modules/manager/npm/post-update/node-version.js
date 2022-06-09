"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNodeUpdate = exports.getNodeConstraint = void 0;
const tslib_1 = require("tslib");
const semver_1 = tslib_1.__importDefault(require("semver"));
const logger_1 = require("../../../../logger");
const fs_1 = require("../../../../util/fs");
const regex_1 = require("../../../../util/regex");
async function getNodeFile(filename) {
    try {
        const constraint = (await (0, fs_1.readLocalFile)(filename, 'utf8'))
            .split(regex_1.newlineRegex)[0]
            .replace((0, regex_1.regEx)(/^v/), '');
        if (semver_1.default.validRange(constraint)) {
            logger_1.logger.debug(`Using node constraint "${constraint}" from ${filename}`);
            return constraint;
        }
    }
    catch (err) {
        // do nothing
    }
    return null;
}
function getPackageJsonConstraint(config) {
    const constraint = config.constraints?.node;
    if (constraint && semver_1.default.validRange(constraint)) {
        logger_1.logger.debug(`Using node constraint "${constraint}" from package.json`);
        return constraint;
    }
    return null;
}
async function getNodeConstraint(config) {
    const { packageFile } = config;
    const constraint = (await getNodeFile((0, fs_1.getSiblingFileName)(packageFile, '.nvmrc'))) ||
        (await getNodeFile((0, fs_1.getSiblingFileName)(packageFile, '.node-version'))) ||
        getPackageJsonConstraint(config);
    if (!constraint) {
        logger_1.logger.debug('No node constraint found - using latest');
    }
    return constraint;
}
exports.getNodeConstraint = getNodeConstraint;
function getNodeUpdate(upgrades) {
    return upgrades.find((u) => u.depName === 'node')?.newValue;
}
exports.getNodeUpdate = getNodeUpdate;
//# sourceMappingURL=node-version.js.map