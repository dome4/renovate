"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleRecursive = exports.handleCombination = exports.handleAny = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const regex_1 = require("../../../util/regex");
const utils_1 = require("./utils");
function handleAny(content, packageFile, config) {
    return config.matchStrings
        .map((matchString) => (0, regex_1.regEx)(matchString, 'g'))
        .flatMap((regex) => (0, utils_1.regexMatchAll)(regex, content)) // match all regex to content, get all matches, reduce to single array
        .map((matchResult) => (0, utils_1.createDependency)({ groups: matchResult.groups ?? {}, replaceString: matchResult[0] }, config))
        .filter(is_1.default.truthy);
}
exports.handleAny = handleAny;
function handleCombination(content, packageFile, config) {
    const matches = config.matchStrings
        .map((matchString) => (0, regex_1.regEx)(matchString, 'g'))
        .flatMap((regex) => (0, utils_1.regexMatchAll)(regex, content)); // match all regex to content, get all matches, reduce to single array
    if (!matches.length) {
        return [];
    }
    const extraction = matches
        .map((match) => ({
        groups: match.groups ?? {},
        replaceString: match?.groups?.currentValue ? match[0] : undefined,
    }))
        .reduce((base, addition) => (0, utils_1.mergeExtractionTemplate)(base, addition));
    return [(0, utils_1.createDependency)(extraction, config)].filter(is_1.default.truthy);
}
exports.handleCombination = handleCombination;
function handleRecursive(content, packageFile, config, index = 0, combinedGroups = {}) {
    const regexes = config.matchStrings.map((matchString) => (0, regex_1.regEx)(matchString, 'g'));
    // abort if we have no matchString anymore
    if (!regexes[index]) {
        return [];
    }
    return (0, utils_1.regexMatchAll)(regexes[index], content)
        .flatMap((match) => {
        // if we have a depName and a currentValue which have the minimal viable definition
        if (match?.groups?.depName && match?.groups?.currentValue) {
            return (0, utils_1.createDependency)({
                groups: (0, utils_1.mergeGroups)(combinedGroups, match.groups),
                replaceString: match[0],
            }, config);
        }
        return handleRecursive(match[0], packageFile, config, index + 1, (0, utils_1.mergeGroups)(combinedGroups, match.groups || {}));
    })
        .filter(is_1.default.truthy);
}
exports.handleRecursive = handleRecursive;
//# sourceMappingURL=strategies.js.map