"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processHostRules = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const hostRules = tslib_1.__importStar(require("../../../../util/host-rules"));
const regex_1 = require("../../../../util/regex");
const string_1 = require("../../../../util/string");
const url_1 = require("../../../../util/url");
function processHostRules() {
    let additionalYarnRcYml;
    // Determine the additional npmrc content to add based on host rules
    const additionalNpmrcContent = [];
    const npmHostRules = hostRules.findAll({
        hostType: 'npm',
    });
    for (const hostRule of npmHostRules) {
        if (hostRule.resolvedHost) {
            let uri = hostRule.matchHost;
            uri =
                is_1.default.string(uri) && (0, url_1.validateUrl)(uri)
                    ? uri.replace((0, regex_1.regEx)(/^https?:/), '')
                    : `//${uri}/`;
            if (hostRule.token) {
                const key = hostRule.authType === 'Basic' ? '_auth' : '_authToken';
                additionalNpmrcContent.push(`${uri}:${key}=${hostRule.token}`);
                additionalYarnRcYml || (additionalYarnRcYml = { npmRegistries: {} });
                if (hostRule.authType === 'Basic') {
                    additionalYarnRcYml.npmRegistries[uri] = {
                        npmAuthIdent: hostRule.token,
                    };
                }
                else {
                    additionalYarnRcYml.npmRegistries[uri] = {
                        npmAuthToken: hostRule.token,
                    };
                }
            }
            else if (is_1.default.string(hostRule.username) && is_1.default.string(hostRule.password)) {
                const password = (0, string_1.toBase64)(hostRule.password);
                additionalNpmrcContent.push(`${uri}:username=${hostRule.username}`);
                additionalNpmrcContent.push(`${uri}:_password=${password}`);
                additionalYarnRcYml || (additionalYarnRcYml = { npmRegistries: {} });
                additionalYarnRcYml.npmRegistries[uri] = {
                    npmAuthIdent: `${hostRule.username}:${hostRule.password}`,
                };
            }
        }
    }
    return { additionalNpmrcContent, additionalYarnRcYml };
}
exports.processHostRules = processHostRules;
//# sourceMappingURL=rules.js.map