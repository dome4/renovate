"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPreset = exports.getPresetFromEndpoint = exports.fetchJSONFile = exports.Endpoint = void 0;
const logger_1 = require("../../../logger");
const gitea_helper_1 = require("../../../modules/platform/gitea/gitea-helper");
const external_host_error_1 = require("../../../types/errors/external-host-error");
const string_1 = require("../../../util/string");
const util_1 = require("../util");
exports.Endpoint = 'https://gitea.com/';
async function fetchJSONFile(repo, fileName, endpoint, tag) {
    let res;
    try {
        res = await (0, gitea_helper_1.getRepoContents)(repo, fileName, tag, {
            baseUrl: endpoint,
        });
    }
    catch (err) {
        // istanbul ignore if: not testable with nock
        if (err instanceof external_host_error_1.ExternalHostError) {
            throw err;
        }
        logger_1.logger.debug({ statusCode: err.statusCode, repo, fileName }, `Failed to retrieve ${fileName} from repo`);
        throw new Error(util_1.PRESET_DEP_NOT_FOUND);
    }
    // TODO: null check #7154
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    return (0, util_1.parsePreset)((0, string_1.fromBase64)(res.content));
}
exports.fetchJSONFile = fetchJSONFile;
function getPresetFromEndpoint(repo, filePreset, presetPath, endpoint = exports.Endpoint, tag) {
    return (0, util_1.fetchPreset)({
        repo,
        filePreset,
        presetPath,
        endpoint,
        tag,
        fetch: fetchJSONFile,
    });
}
exports.getPresetFromEndpoint = getPresetFromEndpoint;
function getPreset({ repo, presetName = 'default', presetPath, tag = undefined, }) {
    return getPresetFromEndpoint(repo, presetName, presetPath, exports.Endpoint, tag);
}
exports.getPreset = getPreset;
//# sourceMappingURL=index.js.map