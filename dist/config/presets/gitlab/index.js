"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPreset = exports.getPresetFromEndpoint = exports.fetchJSONFile = exports.Endpoint = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const logger_1 = require("../../../logger");
const external_host_error_1 = require("../../../types/errors/external-host-error");
const gitlab_1 = require("../../../util/http/gitlab");
const util_1 = require("../util");
const gitlabApi = new gitlab_1.GitlabHttp();
exports.Endpoint = 'https://gitlab.com/api/v4/';
async function getDefaultBranchName(urlEncodedPkgName, endpoint) {
    const branchesUrl = `${endpoint}projects/${urlEncodedPkgName}/repository/branches`;
    const res = await gitlabApi.getJson(branchesUrl);
    const branches = res.body;
    let defaultBranchName = 'master';
    for (const branch of branches) {
        if (branch.default) {
            defaultBranchName = branch.name;
            break;
        }
    }
    return defaultBranchName;
}
async function fetchJSONFile(repo, fileName, endpoint, tag) {
    let url = endpoint;
    let ref = '';
    try {
        const urlEncodedRepo = encodeURIComponent(repo);
        const urlEncodedPkgName = encodeURIComponent(fileName);
        if (is_1.default.nonEmptyString(tag)) {
            ref = `?ref=${tag}`;
        }
        else {
            const defaultBranchName = await getDefaultBranchName(urlEncodedRepo, endpoint);
            ref = `?ref=${defaultBranchName}`;
        }
        url += `projects/${urlEncodedRepo}/repository/files/${urlEncodedPkgName}/raw${ref}`;
        logger_1.logger.trace({ url }, `Preset URL`);
        return (await gitlabApi.getJson(url)).body;
    }
    catch (err) {
        if (err instanceof external_host_error_1.ExternalHostError) {
            throw err;
        }
        logger_1.logger.debug({ statusCode: err.statusCode, url }, `Failed to retrieve ${fileName} from repo`);
        throw new Error(util_1.PRESET_DEP_NOT_FOUND);
    }
}
exports.fetchJSONFile = fetchJSONFile;
function getPresetFromEndpoint(repo, presetName, presetPath, endpoint = exports.Endpoint, tag) {
    return (0, util_1.fetchPreset)({
        repo,
        filePreset: presetName,
        presetPath,
        endpoint,
        tag,
        fetch: fetchJSONFile,
    });
}
exports.getPresetFromEndpoint = getPresetFromEndpoint;
function getPreset({ repo, presetPath, presetName = 'default', tag = undefined, }) {
    return getPresetFromEndpoint(repo, presetName, presetPath, exports.Endpoint, tag);
}
exports.getPreset = getPreset;
//# sourceMappingURL=index.js.map