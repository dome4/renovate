"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BITBUCKET_API_USING_HOST_TYPES = exports.GITLAB_API_USING_HOST_TYPES = exports.GITHUB_API_USING_HOST_TYPES = exports.PlatformId = void 0;
// eslint-disable-next-line typescript-enum/no-enum, typescript-enum/no-const-enum
var PlatformId;
(function (PlatformId) {
    PlatformId["Azure"] = "azure";
    PlatformId["Bitbucket"] = "bitbucket";
    PlatformId["BitbucketServer"] = "bitbucket-server";
    PlatformId["Gitea"] = "gitea";
    PlatformId["Github"] = "github";
    PlatformId["Gitlab"] = "gitlab";
})(PlatformId = exports.PlatformId || (exports.PlatformId = {}));
exports.GITHUB_API_USING_HOST_TYPES = [
    PlatformId.Github,
    'github-releases',
    'github-tags',
    'pod',
    'github-changelog',
];
exports.GITLAB_API_USING_HOST_TYPES = [
    PlatformId.Gitlab,
    'gitlab-releases',
    'gitlab-tags',
    'gitlab-packages',
    'gitlab-changelog',
];
exports.BITBUCKET_API_USING_HOST_TYPES = [
    PlatformId.Bitbucket,
    'bitbucket-tags',
];
//# sourceMappingURL=platforms.js.map