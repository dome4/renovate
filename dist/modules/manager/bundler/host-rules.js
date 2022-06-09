"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthenticationHeaderValue = exports.findAllAuthenticatable = void 0;
const host_rules_1 = require("../../../util/host-rules");
function isAuthenticatable(rule) {
    return (!!rule.resolvedHost &&
        ((!!rule.username && !!rule.password) || !!rule.token));
}
function findAllAuthenticatable({ hostType, }) {
    return (0, host_rules_1.findAll)({ hostType }).filter(isAuthenticatable);
}
exports.findAllAuthenticatable = findAllAuthenticatable;
function getAuthenticationHeaderValue(hostRule) {
    if (hostRule.username) {
        return `${hostRule.username}:${hostRule.password}`;
    }
    return `${hostRule.token}`;
}
exports.getAuthenticationHeaderValue = getAuthenticationHeaderValue;
//# sourceMappingURL=host-rules.js.map