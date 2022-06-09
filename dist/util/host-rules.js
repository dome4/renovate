"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clear = exports.getAll = exports.findAll = exports.hostType = exports.hosts = exports.find = exports.add = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const deepmerge_1 = tslib_1.__importDefault(require("deepmerge"));
const logger_1 = require("../logger");
const clone_1 = require("./clone");
const sanitize = tslib_1.__importStar(require("./sanitize"));
const string_1 = require("./string");
const url_1 = require("./url");
let hostRules = [];
function migrateRule(rule) {
    const cloned = (0, clone_1.clone)(rule);
    delete cloned.hostName;
    delete cloned.domainName;
    delete cloned.baseUrl;
    const result = cloned;
    const { matchHost } = result;
    const { hostName, domainName, baseUrl } = rule;
    const hostValues = [matchHost, hostName, domainName, baseUrl].filter(Boolean);
    if (hostValues.length === 1) {
        const [matchHost] = hostValues;
        result.matchHost = matchHost;
    }
    else if (hostValues.length > 1) {
        throw new Error(`hostRules cannot contain more than one host-matching field - use "matchHost" only.`);
    }
    return result;
}
function add(params) {
    const rule = migrateRule(params);
    const confidentialFields = ['password', 'token'];
    if (rule.matchHost) {
        const parsedUrl = (0, url_1.parseUrl)(rule.matchHost);
        rule.resolvedHost = parsedUrl?.hostname ?? rule.matchHost;
        confidentialFields.forEach((field) => {
            if (rule[field]) {
                logger_1.logger.debug(`Adding ${field} authentication for ${rule.matchHost} to hostRules`);
            }
        });
    }
    confidentialFields.forEach((field) => {
        const secret = rule[field];
        if (is_1.default.string(secret) && secret.length > 3) {
            sanitize.addSecretForSanitizing(secret);
        }
    });
    if (rule.username && rule.password) {
        sanitize.addSecretForSanitizing((0, string_1.toBase64)(`${rule.username}:${rule.password}`));
    }
    hostRules.push(rule);
}
exports.add = add;
function isEmptyRule(rule) {
    return !rule.hostType && !rule.resolvedHost;
}
function isHostTypeRule(rule) {
    return !!rule.hostType && !rule.resolvedHost;
}
function isHostOnlyRule(rule) {
    return !rule.hostType && !!rule.matchHost;
}
function isMultiRule(rule) {
    return !!rule.hostType && !!rule.resolvedHost;
}
function matchesHostType(rule, search) {
    return rule.hostType === search.hostType;
}
function matchesHost(rule, search) {
    // istanbul ignore if
    if (!rule.matchHost) {
        return false;
    }
    if (search.url && (0, url_1.validateUrl)(rule.matchHost)) {
        return search.url.startsWith(rule.matchHost);
    }
    const parsedUrl = search.url ? (0, url_1.parseUrl)(search.url) : null;
    if (!parsedUrl?.hostname) {
        return false;
    }
    const { hostname } = parsedUrl;
    const dotPrefixedMatchHost = rule.matchHost.startsWith('.')
        ? rule.matchHost
        : `.${rule.matchHost}`;
    return hostname === rule.matchHost || hostname.endsWith(dotPrefixedMatchHost);
}
function prioritizeLongestMatchHost(rule1, rule2) {
    // istanbul ignore if: won't happen in practice
    if (!rule1.matchHost || !rule2.matchHost) {
        return 0;
    }
    return rule1.matchHost.length - rule2.matchHost.length;
}
function find(search) {
    if (!(search.hostType || search.url)) {
        logger_1.logger.warn({ search }, 'Invalid hostRules search');
        return {};
    }
    let res = {};
    // First, apply empty rule matches
    hostRules
        .filter((rule) => isEmptyRule(rule))
        .forEach((rule) => {
        res = (0, deepmerge_1.default)(res, rule);
    });
    // Next, find hostType-only matches
    hostRules
        .filter((rule) => isHostTypeRule(rule) && matchesHostType(rule, search))
        .forEach((rule) => {
        res = (0, deepmerge_1.default)(res, rule);
    });
    hostRules
        .filter((rule) => isHostOnlyRule(rule) && matchesHost(rule, search))
        .sort(prioritizeLongestMatchHost)
        .forEach((rule) => {
        res = (0, deepmerge_1.default)(res, rule);
    });
    // Finally, find combination matches
    hostRules
        .filter((rule) => isMultiRule(rule) &&
        matchesHostType(rule, search) &&
        matchesHost(rule, search))
        .sort(prioritizeLongestMatchHost)
        .forEach((rule) => {
        res = (0, deepmerge_1.default)(res, rule);
    });
    delete res.hostType;
    delete res.resolvedHost;
    delete res.matchHost;
    return res;
}
exports.find = find;
function hosts({ hostType }) {
    return hostRules
        .filter((rule) => rule.hostType === hostType)
        .map((rule) => rule.resolvedHost)
        .filter(is_1.default.truthy);
}
exports.hosts = hosts;
function hostType({ url }) {
    return (hostRules
        .filter((rule) => matchesHost(rule, { url }))
        .sort(prioritizeLongestMatchHost)
        .map((rule) => rule.hostType)
        .filter(is_1.default.truthy)
        .pop() ?? null);
}
exports.hostType = hostType;
function findAll({ hostType }) {
    return hostRules.filter((rule) => rule.hostType === hostType);
}
exports.findAll = findAll;
/**
 * @returns a deep copy of all known host rules without any filtering
 */
function getAll() {
    return (0, clone_1.clone)(hostRules);
}
exports.getAll = getAll;
function clear() {
    logger_1.logger.debug('Clearing hostRules');
    hostRules = [];
    sanitize.clearSanitizedSecretsList();
}
exports.clear = clear;
//# sourceMappingURL=host-rules.js.map