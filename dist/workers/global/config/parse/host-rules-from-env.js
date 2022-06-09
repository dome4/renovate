"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hostRulesFromEnv = void 0;
const logger_1 = require("../../../../logger");
const datasource_1 = require("../../../../modules/datasource");
function hostRulesFromEnv(env) {
    const datasources = new Set((0, datasource_1.getDatasourceList)());
    const fields = ['token', 'username', 'password'];
    const hostRules = [];
    const npmEnvPrefixes = ['npm_config_', 'npm_lifecycle_', 'npm_package_'];
    for (const envName of Object.keys(env).sort()) {
        if (npmEnvPrefixes.some((prefix) => envName.startsWith(prefix))) {
            logger_1.logger.trace('Ignoring npm env: ' + envName);
            continue;
        }
        // Double underscore __ is used in place of hyphen -
        const splitEnv = envName.toLowerCase().replace(/__/g, '-').split('_');
        const hostType = splitEnv.shift();
        if (datasources.has(hostType)) {
            const suffix = splitEnv.pop();
            if (fields.includes(suffix)) {
                let matchHost;
                const rule = {};
                rule[suffix] = env[envName];
                if (splitEnv.length === 0) {
                    // host-less rule
                }
                else if (splitEnv.length === 1) {
                    logger_1.logger.warn(`Cannot parse ${envName} env`);
                    continue;
                }
                else {
                    matchHost = splitEnv.join('.');
                }
                const existingRule = hostRules.find((hr) => hr.hostType === hostType && hr.matchHost === matchHost);
                logger_1.logger.debug(`Converting ${envName} into a global host rule`);
                if (existingRule) {
                    // Add current field to existing rule
                    existingRule[suffix] = env[envName];
                }
                else {
                    // Create a new rule
                    const newRule = {
                        hostType,
                    };
                    if (matchHost) {
                        newRule.matchHost = matchHost;
                    }
                    newRule[suffix] = env[envName];
                    hostRules.push(newRule);
                }
            }
        }
    }
    return hostRules;
}
exports.hostRulesFromEnv = hostRulesFromEnv;
//# sourceMappingURL=host-rules-from-env.js.map