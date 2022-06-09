"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBundlerConstraint = exports.getRubyConstraint = exports.extractRubyVersion = exports.delimiters = void 0;
const logger_1 = require("../../../logger");
const fs_1 = require("../../../util/fs");
const regex_1 = require("../../../util/regex");
exports.delimiters = ['"', "'"];
function extractRubyVersion(txt) {
    const rubyMatch = (0, regex_1.regEx)(/^ruby\s+("[^"]+"|'[^']+')\s*$/gm).exec(txt);
    if (rubyMatch?.length !== 2) {
        return null;
    }
    const quotedVersion = rubyMatch[1];
    return quotedVersion.substring(1, quotedVersion.length - 1);
}
exports.extractRubyVersion = extractRubyVersion;
async function getRubyConstraint(updateArtifact) {
    const { packageFileName, config, newPackageFileContent } = updateArtifact;
    const { constraints = {} } = config;
    const { ruby } = constraints;
    if (ruby) {
        logger_1.logger.debug('Using ruby constraint from config');
        return ruby;
    }
    else {
        const rubyMatch = extractRubyVersion(newPackageFileContent);
        if (rubyMatch) {
            logger_1.logger.debug('Using ruby version from gemfile');
            return rubyMatch;
        }
        const rubyVersionFile = (0, fs_1.getSiblingFileName)(packageFileName, '.ruby-version');
        const rubyVersionFileContent = await (0, fs_1.readLocalFile)(rubyVersionFile, 'utf8');
        if (rubyVersionFileContent) {
            logger_1.logger.debug('Using ruby version specified in .ruby-version');
            return rubyVersionFileContent
                .replace((0, regex_1.regEx)(/^ruby-/), '')
                .replace((0, regex_1.regEx)(/\n/g), '')
                .trim();
        }
    }
    return null;
}
exports.getRubyConstraint = getRubyConstraint;
function getBundlerConstraint(updateArtifact, existingLockFileContent) {
    const { config } = updateArtifact;
    const { constraints = {} } = config;
    const { bundler } = constraints;
    if (bundler) {
        logger_1.logger.debug('Using bundler contraint from config');
        return bundler;
    }
    else {
        const bundledWith = (0, regex_1.regEx)(/\nBUNDLED WITH\n\s+(.*?)(\n|$)/).exec(existingLockFileContent);
        if (bundledWith) {
            logger_1.logger.debug('Using bundler version specified in lockfile');
            return bundledWith[1];
        }
    }
    return null;
}
exports.getBundlerConstraint = getBundlerConstraint;
//# sourceMappingURL=common.js.map