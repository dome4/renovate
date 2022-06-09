"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compile = exports.allowedFields = exports.exposedConfigOptions = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const handlebars_1 = tslib_1.__importDefault(require("handlebars"));
const global_1 = require("../../config/global");
const logger_1 = require("../../logger");
const clone_1 = require("../clone");
handlebars_1.default.registerHelper('encodeURIComponent', encodeURIComponent);
handlebars_1.default.registerHelper('stringToPrettyJSON', (input) => JSON.stringify(JSON.parse(input), null, 2));
// istanbul ignore next
handlebars_1.default.registerHelper('replace', (find, replace, context) => (context || '').replace(new RegExp(find, 'g'), replace) // TODO #12873
);
handlebars_1.default.registerHelper('lowercase', (str) => str.toLowerCase());
handlebars_1.default.registerHelper('containsString', (str, subStr, options) => str.includes(subStr));
handlebars_1.default.registerHelper({
    and(...args) {
        // Need to remove the 'options', as last parameter
        // https://handlebarsjs.com/api-reference/helpers.html
        args.pop();
        return args.every(Boolean);
    },
    or(...args) {
        // Need to remove the 'options', as last parameter
        // https://handlebarsjs.com/api-reference/helpers.html
        args.pop();
        return args.some(Boolean);
    },
});
exports.exposedConfigOptions = [
    'additionalBranchPrefix',
    'addLabels',
    'branchName',
    'branchPrefix',
    'branchTopic',
    'commitMessage',
    'commitMessageAction',
    'commitMessageExtra',
    'commitMessagePrefix',
    'commitMessageSuffix',
    'commitMessageTopic',
    'gitAuthor',
    'group',
    'groupName',
    'groupSlug',
    'labels',
    'prBodyColumns',
    'prBodyDefinitions',
    'prBodyNotes',
    'prTitle',
    'semanticCommitScope',
    'semanticCommitType',
    'separateMajorMinor',
    'separateMinorPatch',
];
exports.allowedFields = {
    baseBranch: 'The baseBranch for this branch/PR',
    body: 'The body of the release notes',
    currentValue: 'The extracted current value of the dependency being updated',
    currentVersion: 'The version that would be currently installed. For example, if currentValue is ^3.0.0 then currentVersion might be 3.1.0.',
    currentDigest: 'The extracted current digest of the dependency being updated',
    currentDigestShort: 'The extracted current short digest of the dependency being updated',
    datasource: 'The datasource used to look up the upgrade',
    depName: 'The name of the dependency being updated',
    depNameLinked: 'The dependency name already linked to its home page using markdown',
    depNameSanitized: 'The depName field sanitized for use in branches after removing spaces and special characters',
    depType: 'The dependency type (if extracted - manager-dependent)',
    displayFrom: 'The current value, formatted for display',
    displayPending: 'Latest pending update, if internalChecksFilter is in use',
    displayTo: 'The to value, formatted for display',
    hasReleaseNotes: 'true if the upgrade has release notes',
    isLockfileUpdate: 'true if the branch is a lock file update',
    isMajor: 'true if the upgrade is major',
    isPatch: 'true if the upgrade is a patch upgrade',
    isPin: 'true if the upgrade is pinning dependencies',
    isPinDigest: 'true if the upgrade is pinning digests',
    isRollback: 'true if the upgrade is a rollback PR',
    isReplacement: 'true if the upgrade is a replacement',
    isRange: 'true if the new value is a range',
    isSingleVersion: 'true if the upgrade is to a single version rather than a range',
    logJSON: 'ChangeLogResult object for the upgrade',
    manager: 'The (package) manager which detected the dependency',
    newDigest: 'The new digest value',
    newDigestShort: 'A shorted version of newDigest, for use when the full digest is too long to be conveniently displayed',
    newMajor: 'The major version of the new version. e.g. "3" if the new version if "3.1.0"',
    newMinor: 'The minor version of the new version. e.g. "1" if the new version if "3.1.0"',
    newName: 'The name of the new dependency that replaces the current deprecated dependency',
    newValue: 'The new value in the upgrade. Can be a range or version e.g. "^3.0.0" or "3.1.0"',
    newVersion: 'The new version in the upgrade, e.g. "3.1.0"',
    packageFile: 'The filename that the dependency was found in',
    packageFileDir: 'The directory with full path where the packageFile was found',
    packageName: 'The full name that was used to look up the dependency',
    parentDir: 'The name of the directory that the dependency was found in, without full path',
    platform: 'VCS platform in use, e.g. "github", "gitlab", etc.',
    prettyDepType: 'Massaged depType',
    project: 'ChangeLogProject object',
    recreateClosed: 'If true, this PR will be recreated if closed',
    references: 'A list of references for the upgrade',
    releases: 'An array of releases for an upgrade',
    releaseNotes: 'A ChangeLogNotes object for the release',
    repository: 'The current repository',
    semanticPrefix: 'The fully generated semantic prefix for commit messages',
    sourceRepo: 'The repository in the sourceUrl, if present',
    sourceRepoName: 'The repository name in the sourceUrl, if present',
    sourceRepoOrg: 'The repository organization in the sourceUrl, if present',
    sourceRepoSlug: 'The slugified pathname of the sourceUrl, if present',
    sourceUrl: 'The source URL for the package',
    updateType: 'One of digest, pin, rollback, patch, minor, major, replacement, pinDigest',
    upgrades: 'An array of upgrade objects in the branch',
    url: 'The url of the release notes',
    version: 'The version number of the changelog',
    versioning: 'The versioning scheme in use',
    versions: 'An array of ChangeLogRelease objects in the upgrade',
};
const prBodyFields = [
    'header',
    'table',
    'notes',
    'changelogs',
    'configDescription',
    'controls',
    'footer',
];
const handlebarsUtilityFields = ['else'];
const allowedFieldsList = Object.keys(exports.allowedFields)
    .concat(exports.exposedConfigOptions)
    .concat(prBodyFields)
    .concat(handlebarsUtilityFields);
function getFilteredObject(input) {
    const obj = (0, clone_1.clone)(input);
    const res = {};
    const allAllowed = [
        ...Object.keys(exports.allowedFields),
        ...exports.exposedConfigOptions,
    ].sort();
    for (const field of allAllowed) {
        const value = obj[field];
        if (is_1.default.array(value)) {
            res[field] = value
                .filter(is_1.default.plainObject)
                .map((element) => getFilteredObject(element));
        }
        else if (is_1.default.plainObject(value)) {
            res[field] = getFilteredObject(value);
        }
        else if (!is_1.default.undefined(value)) {
            res[field] = value;
        }
    }
    return res;
}
const templateRegex = /{{(#(if|unless) )?([a-zA-Z]+)}}/g; // TODO #12873
function compile(template, input, filterFields = true) {
    const data = { ...global_1.GlobalConfig.get(), ...input };
    const filteredInput = filterFields ? getFilteredObject(data) : data;
    logger_1.logger.trace({ template, filteredInput }, 'Compiling template');
    if (filterFields) {
        const matches = template.matchAll(templateRegex);
        for (const match of matches) {
            const varName = match[3];
            if (!allowedFieldsList.includes(varName)) {
                logger_1.logger.info({ varName, template }, 'Disallowed variable name in template');
            }
        }
    }
    return handlebars_1.default.compile(template)(filteredInput);
}
exports.compile = compile;
//# sourceMappingURL=index.js.map