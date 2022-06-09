"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPreset = void 0;
const tslib_1 = require("tslib");
const constants_1 = require("../../../constants");
const global_1 = require("../../global");
const azure = tslib_1.__importStar(require("../azure"));
const bitbucket = tslib_1.__importStar(require("../bitbucket"));
const bitbucketServer = tslib_1.__importStar(require("../bitbucket-server"));
const gitea = tslib_1.__importStar(require("../gitea"));
const github = tslib_1.__importStar(require("../github"));
const gitlab = tslib_1.__importStar(require("../gitlab"));
const resolvers = {
    [constants_1.PlatformId.Azure]: azure,
    [constants_1.PlatformId.Bitbucket]: bitbucket,
    [constants_1.PlatformId.BitbucketServer]: bitbucketServer,
    [constants_1.PlatformId.Gitea]: gitea,
    [constants_1.PlatformId.Github]: github,
    [constants_1.PlatformId.Gitlab]: gitlab,
};
function getPreset({ repo, presetName = 'default', presetPath, tag, }) {
    const { platform, endpoint } = global_1.GlobalConfig.get();
    if (!platform) {
        throw new Error(`Missing platform config for local preset.`);
    }
    const resolver = resolvers[platform.toLowerCase()];
    if (!resolver) {
        throw new Error(
        // TODO: can be undefined? #7154
        `Unsupported platform '${platform}' for local preset.`);
    }
    return resolver.getPresetFromEndpoint(repo, presetName, presetPath, 
    // TODO: fix type #7154
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    endpoint, tag);
}
exports.getPreset = getPreset;
//# sourceMappingURL=index.js.map