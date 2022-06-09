"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setEndpoint = exports.policyApi = exports.coreApi = exports.gitApi = exports.azureObj = void 0;
const tslib_1 = require("tslib");
const azure = tslib_1.__importStar(require("azure-devops-node-api"));
const azure_devops_node_api_1 = require("azure-devops-node-api");
const constants_1 = require("../../../constants");
const hostRules = tslib_1.__importStar(require("../../../util/host-rules"));
const hostType = constants_1.PlatformId.Azure;
let endpoint;
function getAuthenticationHandler(config) {
    if (!config.token && config.username && config.password) {
        return (0, azure_devops_node_api_1.getBasicHandler)(config.username, config.password, true);
    }
    // TODO: token can be undefined here
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    return (0, azure_devops_node_api_1.getHandlerFromToken)(config.token, true);
}
function azureObj() {
    const config = hostRules.find({ hostType, url: endpoint });
    if (!config.token && !(config.username && config.password)) {
        throw new Error(`No config found for azure`);
    }
    const authHandler = getAuthenticationHandler(config);
    return new azure.WebApi(endpoint, authHandler);
}
exports.azureObj = azureObj;
function gitApi() {
    return azureObj().getGitApi();
}
exports.gitApi = gitApi;
function coreApi() {
    return azureObj().getCoreApi();
}
exports.coreApi = coreApi;
function policyApi() {
    return azureObj().getPolicyApi();
}
exports.policyApi = policyApi;
function setEndpoint(e) {
    endpoint = e;
}
exports.setEndpoint = setEndpoint;
//# sourceMappingURL=azure-got-wrapper.js.map