"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getChildProcessEnv = void 0;
const global_1 = require("../../config/global");
const basicEnvVars = [
    'HTTP_PROXY',
    'HTTPS_PROXY',
    'NO_PROXY',
    'http_proxy',
    'https_proxy',
    'no_proxy',
    'HOME',
    'PATH',
    'LC_ALL',
    'LANG',
    'DOCKER_HOST',
    'DOCKER_TLS_VERIFY',
    'DOCKER_CERT_PATH',
];
function getChildProcessEnv(customEnvVars = []) {
    const env = {};
    if (global_1.GlobalConfig.get('exposeAllEnv')) {
        return { ...env, ...process.env };
    }
    const envVars = [...basicEnvVars, ...customEnvVars];
    envVars.forEach((envVar) => {
        if (typeof process.env[envVar] !== 'undefined') {
            env[envVar] = process.env[envVar];
        }
    });
    return env;
}
exports.getChildProcessEnv = getChildProcessEnv;
//# sourceMappingURL=env.js.map