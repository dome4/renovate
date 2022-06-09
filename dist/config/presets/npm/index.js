"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPreset = void 0;
const logger_1 = require("../../../logger");
const npmrc_1 = require("../../../modules/datasource/npm/npmrc");
const http_1 = require("../../../util/http");
const util_1 = require("../util");
const id = 'npm';
const http = new http_1.Http(id);
async function getPreset({ repo: pkg, presetName = 'default', }) {
    let dep;
    try {
        const registryUrl = (0, npmrc_1.resolveRegistryUrl)(pkg);
        const packageUrl = (0, npmrc_1.resolvePackageUrl)(registryUrl, pkg);
        // istanbul ignore if
        if (!packageUrl.startsWith('https://registry.npmjs.org/')) {
            logger_1.logger.warn('npm presets from non-default registries are now deprecated. Please migrate to repository-based presets instead.');
        }
        const body = (await http.getJson(packageUrl)).body;
        // TODO: check null #7154
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        dep = body.versions[body['dist-tags'].latest];
    }
    catch (err) {
        throw new Error(util_1.PRESET_DEP_NOT_FOUND);
    }
    if (!dep?.['renovate-config']) {
        throw new Error(util_1.PRESET_RENOVATE_CONFIG_NOT_FOUND);
    }
    const presetConfig = dep['renovate-config'][presetName];
    if (!presetConfig) {
        const presetNames = Object.keys(dep['renovate-config']);
        logger_1.logger.debug({ presetNames, presetName }, 'Preset not found within renovate-config');
        throw new Error(util_1.PRESET_NOT_FOUND);
    }
    return presetConfig;
}
exports.getPreset = getPreset;
//# sourceMappingURL=index.js.map