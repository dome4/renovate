"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGitlabDep = exports.replaceReferenceTags = void 0;
const regex_1 = require("../../../util/regex");
const extract_1 = require("../dockerfile/extract");
const re = /!reference \[(.*?)\]/g;
/**
 * Replaces GitLab reference tags before parsing, because our yaml parser cannot process them anyway.
 * @param content pipeline yaml
 * @returns replaced pipeline content
 * https://docs.gitlab.com/ee/ci/yaml/#reference-tags
 */
function replaceReferenceTags(content) {
    const res = content.replace(re, '');
    return res;
}
exports.replaceReferenceTags = replaceReferenceTags;
const depProxyRe = (0, regex_1.regEx)(`(?<prefix>\\$\\{?CI_DEPENDENCY_PROXY_(?:DIRECT_)?GROUP_IMAGE_PREFIX\\}?\\/)(?<depName>.+)`);
/**
 * Get image dependencies respecting Gitlab Dependency Proxy
 * @param imageName as used in .gitlab-ci.yml file
 * @return package dependency for the image
 */
function getGitlabDep(imageName) {
    const match = depProxyRe.exec(imageName);
    if (match?.groups) {
        const dep = { ...(0, extract_1.getDep)(match.groups.depName), replaceString: imageName };
        dep.autoReplaceStringTemplate =
            match.groups.prefix + dep.autoReplaceStringTemplate;
        return dep;
    }
    else {
        return (0, extract_1.getDep)(imageName);
    }
}
exports.getGitlabDep = getGitlabDep;
//# sourceMappingURL=utils.js.map