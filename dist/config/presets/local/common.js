"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPresetFromEndpoint = exports.fetchJSONFile = void 0;
const logger_1 = require("../../../logger");
const platform_1 = require("../../../modules/platform");
const external_host_error_1 = require("../../../types/errors/external-host-error");
const util_1 = require("../util");
async function fetchJSONFile(repo, fileName, _endpoint) {
    let raw;
    try {
        raw = await platform_1.platform.getRawFile(fileName, repo);
    }
    catch (err) {
        // istanbul ignore if: not testable with nock
        if (err instanceof external_host_error_1.ExternalHostError) {
            throw err;
        }
        logger_1.logger.debug({ err, repo, fileName }, `Failed to retrieve ${fileName} from repo ${repo}`);
        throw new Error(util_1.PRESET_DEP_NOT_FOUND);
    }
    // TODO: null check #7154
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    return (0, util_1.parsePreset)(raw);
}
exports.fetchJSONFile = fetchJSONFile;
function getPresetFromEndpoint(repo, filePreset, presetPath, endpoint, tag) {
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
//# sourceMappingURL=common.js.map