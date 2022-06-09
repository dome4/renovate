"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBranchName = void 0;
const tslib_1 = require("tslib");
const clean_git_ref_1 = tslib_1.__importDefault(require("clean-git-ref"));
const hasha_1 = tslib_1.__importDefault(require("hasha"));
const slugify_1 = tslib_1.__importDefault(require("slugify"));
const logger_1 = require("../../../logger");
const regex_1 = require("../../../util/regex");
const template = tslib_1.__importStar(require("../../../util/template"));
const MIN_HASH_LENGTH = 6;
const RE_MULTIPLE_DASH = (0, regex_1.regEx)(/--+/g);
/**
 * Clean git branch name
 *
 * Remove what clean-git-ref fails to:
 * - leading dot/leading dot after slash
 * - trailing dot
 * - whitespace
 * - chained dashes(breaks markdown comments) are replaced by single dash
 */
function cleanBranchName(branchName) {
    return clean_git_ref_1.default
        .clean(branchName)
        .replace((0, regex_1.regEx)(/^\.|\.$/), '') // leading or trailing dot
        .replace((0, regex_1.regEx)(/\/\./g), '/') // leading dot after slash
        .replace((0, regex_1.regEx)(/\s/g), '') // whitespace
        .replace((0, regex_1.regEx)(/[[\]?:\\^~]/g), '-') // massage out all these characters: : ? [ \ ^ ~
        .replace((0, regex_1.regEx)(/(^|\/)-+/g), '$1') // leading dashes
        .replace((0, regex_1.regEx)(/-+(\/|$)/g), '$1') // trailing dashes
        .replace(RE_MULTIPLE_DASH, '-'); // chained dashes
}
function generateBranchName(update) {
    // Check whether to use a group name
    if (update.groupName) {
        logger_1.logger.debug('Using group branchName template');
        logger_1.logger.debug(`Dependency ${update.depName} is part of group ${update.groupName}`);
        update.groupSlug = (0, slugify_1.default)(update.groupSlug || update.groupName, {
            lower: true,
        });
        if (update.updateType === 'major' && update.separateMajorMinor) {
            if (update.separateMultipleMajor) {
                const newMajor = String(update.newMajor);
                update.groupSlug = `major-${newMajor}-${update.groupSlug}`;
            }
            else {
                update.groupSlug = `major-${update.groupSlug}`;
            }
        }
        if (update.updateType === 'patch' && update.separateMinorPatch) {
            update.groupSlug = `patch-${update.groupSlug}`;
        }
        update.branchTopic = update.group.branchTopic || update.branchTopic;
        update.branchName = update.group.branchName || update.branchName;
    }
    if (update.hashedBranchLength) {
        let hashLength = update.hashedBranchLength - update.branchPrefix.length;
        if (hashLength < MIN_HASH_LENGTH) {
            logger_1.logger.warn(`\`hashedBranchLength\` must allow for at least ${MIN_HASH_LENGTH} characters hashing in addition to \`branchPrefix\`. Using ${MIN_HASH_LENGTH} character hash instead.`);
            hashLength = MIN_HASH_LENGTH;
        }
        const additionalBranchPrefix = template.compile(String(update.additionalBranchPrefix || ''), update);
        const branchTopic = template.compile(String(update.branchTopic || ''), update);
        let hashInput = additionalBranchPrefix + branchTopic;
        // Compile extra times in case of nested templates
        hashInput = template.compile(hashInput, update);
        hashInput = template.compile(hashInput, update);
        const hash = (0, hasha_1.default)(hashInput);
        update.branchName = update.branchPrefix + hash.slice(0, hashLength);
    }
    else {
        update.branchName = template.compile(update.branchName, update);
        // Compile extra times in case of nested templates
        update.branchName = template.compile(update.branchName, update);
        update.branchName = template.compile(update.branchName, update);
    }
    update.branchName = cleanBranchName(update.branchName);
}
exports.generateBranchName = generateBranchName;
//# sourceMappingURL=branch-name.js.map