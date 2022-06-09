"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.codeOwnersForPr = void 0;
const tslib_1 = require("tslib");
const ignore_1 = tslib_1.__importDefault(require("ignore"));
const logger_1 = require("../../../../logger");
const fs_1 = require("../../../../util/fs");
const git_1 = require("../../../../util/git");
const regex_1 = require("../../../../util/regex");
async function codeOwnersForPr(pr) {
    logger_1.logger.debug('Searching for CODEOWNERS file');
    try {
        const codeOwnersFile = (await (0, fs_1.readLocalFile)('CODEOWNERS', 'utf8')) ||
            (await (0, fs_1.readLocalFile)('.github/CODEOWNERS', 'utf8')) ||
            (await (0, fs_1.readLocalFile)('.gitlab/CODEOWNERS', 'utf8')) ||
            (await (0, fs_1.readLocalFile)('docs/CODEOWNERS', 'utf8'));
        if (!codeOwnersFile) {
            logger_1.logger.debug('No CODEOWNERS file found');
            return [];
        }
        logger_1.logger.debug(`Found CODEOWNERS file: ${codeOwnersFile}`);
        const prFiles = await (0, git_1.getBranchFiles)(pr.sourceBranch);
        const rules = codeOwnersFile
            .split(regex_1.newlineRegex)
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith('#'))
            .map((line) => {
            const [pattern, ...usernames] = line.split((0, regex_1.regEx)(/\s+/));
            return {
                usernames,
                match: (path) => {
                    const matcher = (0, ignore_1.default)().add(pattern);
                    return matcher.ignores(path);
                },
            };
        })
            .reverse();
        logger_1.logger.debug({ prFiles, rules }, 'PR files and rules to match for CODEOWNERS');
        const matchingRule = rules.find((rule) => prFiles?.every(rule.match));
        if (!matchingRule) {
            logger_1.logger.debug('No matching CODEOWNERS rule found');
            return [];
        }
        logger_1.logger.debug(`CODEOWNERS matched the following usernames: ${JSON.stringify(matchingRule.usernames)}`);
        return matchingRule.usernames;
    }
    catch (err) {
        logger_1.logger.warn({ err, pr }, 'Failed to determine CODEOWNERS for PR.');
        return [];
    }
}
exports.codeOwnersForPr = codeOwnersForPr;
//# sourceMappingURL=code-owners.js.map