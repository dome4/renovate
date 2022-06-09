"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvePackageUrl = exports.resolveRegistryUrl = exports.setNpmrc = exports.convertNpmrcToRules = exports.getMatchHostFromNpmrcHost = void 0;
const tslib_1 = require("tslib");
const url_1 = tslib_1.__importDefault(require("url"));
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const ini_1 = tslib_1.__importDefault(require("ini"));
const global_1 = require("../../../config/global");
const logger_1 = require("../../../logger");
const hostRules = tslib_1.__importStar(require("../../../util/host-rules"));
const regex_1 = require("../../../util/regex");
const string_1 = require("../../../util/string");
const url_2 = require("../../../util/url");
const common_1 = require("./common");
let npmrc = {};
let npmrcRaw = '';
let packageRules = [];
function envReplace(value, env = process.env) {
    // istanbul ignore if
    if (!is_1.default.string(value)) {
        return value;
    }
    const ENV_EXPR = (0, regex_1.regEx)(/(\\*)\$\{([^}]+)\}/g);
    return value.replace(ENV_EXPR, (match, _esc, envVarName) => {
        if (env[envVarName] === undefined) {
            logger_1.logger.warn('Failed to replace env in config: ' + match);
            throw new Error('env-replace');
        }
        return env[envVarName];
    });
}
function getMatchHostFromNpmrcHost(input) {
    if (input.startsWith('//')) {
        const matchHost = input.replace('//', '');
        if (matchHost.includes('/')) {
            return 'https://' + matchHost;
        }
        return matchHost;
    }
    return input;
}
exports.getMatchHostFromNpmrcHost = getMatchHostFromNpmrcHost;
function convertNpmrcToRules(npmrc) {
    const rules = {
        hostRules: [],
        packageRules: [],
    };
    // Generate hostRules
    const hostType = 'npm';
    const hosts = {};
    for (const [key, value] of Object.entries(npmrc)) {
        if (!is_1.default.nonEmptyString(value)) {
            continue;
        }
        const keyParts = key.split(':');
        const keyType = keyParts.pop();
        let matchHost = '';
        if (keyParts.length) {
            matchHost = getMatchHostFromNpmrcHost(keyParts.join(':'));
        }
        const rule = hosts[matchHost] || {};
        if (keyType === '_authToken' || keyType === '_auth') {
            rule.token = value;
            if (keyType === '_auth') {
                rule.authType = 'Basic';
            }
        }
        else if (keyType === 'username') {
            rule.username = value;
        }
        else if (keyType === '_password') {
            rule.password = (0, string_1.fromBase64)(value);
        }
        else {
            continue; // don't add the rule
        }
        hosts[matchHost] = rule;
    }
    for (const [matchHost, rule] of Object.entries(hosts)) {
        const hostRule = { ...rule, hostType };
        if (matchHost) {
            hostRule.matchHost = matchHost;
        }
        rules.hostRules?.push(hostRule);
    }
    // Generate packageRules
    const matchDatasources = ['npm'];
    const { registry } = npmrc;
    // packageRules order matters, so look for a default registry first
    if (is_1.default.nonEmptyString(registry)) {
        if ((0, url_2.validateUrl)(registry)) {
            // Default registry
            rules.packageRules?.push({
                matchDatasources,
                registryUrls: [registry],
            });
        }
        else {
            logger_1.logger.warn({ registry }, 'Invalid npmrc registry= URL');
        }
    }
    // Now look for scoped registries
    for (const [key, value] of Object.entries(npmrc)) {
        if (!is_1.default.nonEmptyString(value)) {
            continue;
        }
        const keyParts = key.split(':');
        const keyType = keyParts.pop();
        if (keyType === 'registry' && keyParts.length && is_1.default.nonEmptyString(value)) {
            const scope = keyParts.join(':');
            if ((0, url_2.validateUrl)(value)) {
                rules.packageRules?.push({
                    matchDatasources,
                    matchPackagePrefixes: [scope + '/'],
                    registryUrls: [value],
                });
            }
            else {
                logger_1.logger.warn({ scope, registry: value }, 'Invalid npmrc registry= URL');
            }
        }
    }
    return rules;
}
exports.convertNpmrcToRules = convertNpmrcToRules;
function setNpmrc(input) {
    if (input) {
        if (input === npmrcRaw) {
            return;
        }
        const existingNpmrc = npmrc;
        npmrcRaw = input;
        logger_1.logger.debug('Setting npmrc');
        npmrc = ini_1.default.parse(input.replace((0, regex_1.regEx)(/\\n/g), '\n'));
        const { exposeAllEnv } = global_1.GlobalConfig.get();
        for (const [key, val] of Object.entries(npmrc)) {
            if (!exposeAllEnv &&
                key.endsWith('registry') &&
                val &&
                val.includes('localhost')) {
                logger_1.logger.debug({ key, val }, 'Detected localhost registry - rejecting npmrc file');
                npmrc = existingNpmrc;
                return;
            }
        }
        if (exposeAllEnv) {
            for (const key of Object.keys(npmrc)) {
                npmrc[key] = envReplace(npmrc[key]);
            }
        }
        const npmrcRules = convertNpmrcToRules(npmrc);
        if (npmrcRules.hostRules?.length) {
            npmrcRules.hostRules.forEach((hostRule) => hostRules.add(hostRule));
        }
        packageRules = npmrcRules.packageRules;
    }
    else if (npmrc) {
        logger_1.logger.debug('Resetting npmrc');
        npmrc = {};
        npmrcRaw = '';
        packageRules = [];
    }
}
exports.setNpmrc = setNpmrc;
function resolveRegistryUrl(packageName) {
    let registryUrl = common_1.defaultRegistryUrls[0];
    for (const rule of packageRules) {
        const { matchPackagePrefixes, registryUrls } = rule;
        if (!matchPackagePrefixes ||
            packageName.startsWith(matchPackagePrefixes[0])) {
            // TODO: fix types #7154
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            registryUrl = registryUrls[0];
        }
    }
    return registryUrl;
}
exports.resolveRegistryUrl = resolveRegistryUrl;
function resolvePackageUrl(registryUrl, packageName) {
    return url_1.default.resolve((0, url_2.ensureTrailingSlash)(registryUrl), encodeURIComponent(packageName).replace((0, regex_1.regEx)(/^%40/), '@'));
}
exports.resolvePackageUrl = resolvePackageUrl;
//# sourceMappingURL=npmrc.js.map