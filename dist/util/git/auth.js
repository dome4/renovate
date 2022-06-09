"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthenticationRules = exports.getGitAuthenticatedEnvironmentVariables = void 0;
const tslib_1 = require("tslib");
const git_url_parse_1 = tslib_1.__importDefault(require("git-url-parse"));
const constants_1 = require("../../constants");
const logger_1 = require("../../logger");
const regex_1 = require("../regex");
/**
 * Add authorization to a Git Url and returns a new environment variables object
 * @returns a new NodeJS.ProcessEnv object without modifying any input parameters
 */
function getGitAuthenticatedEnvironmentVariables(originalGitUrl, { token, hostType, matchHost }, environmentVariables) {
    if (!token) {
        logger_1.logger.warn(`Could not create environment variable for ${matchHost} as token was empty`);
        return { ...environmentVariables };
    }
    // check if the environmentVariables already contain a GIT_CONFIG_COUNT or if the process has one
    const gitConfigCountEnvVariable = environmentVariables?.GIT_CONFIG_COUNT ?? process.env.GIT_CONFIG_COUNT;
    let gitConfigCount = 0;
    if (gitConfigCountEnvVariable) {
        // passthrough the gitConfigCountEnvVariable environment variable as start value of the index count
        gitConfigCount = parseInt(gitConfigCountEnvVariable, 10);
        if (Number.isNaN(gitConfigCount)) {
            logger_1.logger.warn(`Found GIT_CONFIG_COUNT env variable, but couldn't parse the value to an integer: ${String(process.env.GIT_CONFIG_COUNT)}. Ignoring it.`);
            gitConfigCount = 0;
        }
    }
    const authenticationRules = getAuthenticationRulesWithToken(originalGitUrl, hostType, token);
    // create a shallow copy of the environmentVariables as base so we don't modify the input parameter object
    // add the two new config key and value to the returnEnvironmentVariables object
    // increase the CONFIG_COUNT by one for each rule and add it to the object
    const newEnvironmentVariables = {
        ...environmentVariables,
    };
    for (const rule of authenticationRules) {
        newEnvironmentVariables[`GIT_CONFIG_KEY_${gitConfigCount}`] = `url.${rule.url}.insteadOf`;
        newEnvironmentVariables[`GIT_CONFIG_VALUE_${gitConfigCount}`] =
            rule.insteadOf;
        gitConfigCount++;
    }
    newEnvironmentVariables['GIT_CONFIG_COUNT'] = gitConfigCount.toString();
    return newEnvironmentVariables;
}
exports.getGitAuthenticatedEnvironmentVariables = getGitAuthenticatedEnvironmentVariables;
function getAuthenticationRulesWithToken(url, hostType, authToken) {
    let token = authToken;
    if (hostType === constants_1.PlatformId.Gitlab) {
        token = `gitlab-ci-token:${authToken}`;
    }
    return getAuthenticationRules(url, token);
}
/**
 * Generates the authentication rules for later git usage for the given host
 * @link https://coolaj86.com/articles/vanilla-devops-git-credentials-cheatsheet/
 */
function getAuthenticationRules(gitUrl, token) {
    const authenticationRules = [];
    const hasUser = token.split(':').length > 1;
    const insteadUrl = (0, git_url_parse_1.default)(gitUrl);
    const url = { ...insteadUrl };
    const protocol = (0, regex_1.regEx)(/^https?$/).test(url.protocol)
        ? url.protocol
        : 'https';
    // ssh protocol with user if empty
    url.token = hasUser ? token : `ssh:${token}`;
    authenticationRules.push({
        url: url.toString(protocol),
        // only edge case, need to stringify ourself because the exact syntax is not supported by the library
        // https://github.com/IonicaBizau/git-url-parse/blob/246c9119fb42c2ea1c280028fe77c53eb34c190c/lib/index.js#L246
        insteadOf: `ssh://git@${insteadUrl.resource}${insteadUrl.port ? `:${insteadUrl.port}` : ''}/${insteadUrl.full_name}${insteadUrl.git_suffix ? '.git' : ''}`,
    });
    // alternative ssh protocol with user if empty
    url.token = hasUser ? token : `git:${token}`;
    authenticationRules.push({
        url: url.toString(protocol),
        insteadOf: insteadUrl.toString('ssh'),
    });
    // https protocol with no user as default fallback
    url.token = token;
    authenticationRules.push({
        url: url.toString(protocol),
        insteadOf: insteadUrl.toString(protocol),
    });
    return authenticationRules;
}
exports.getAuthenticationRules = getAuthenticationRules;
//# sourceMappingURL=auth.js.map