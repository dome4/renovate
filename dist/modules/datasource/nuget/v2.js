"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReleases = void 0;
const xmldoc_1 = require("xmldoc");
const logger_1 = require("../../../logger");
const regex_1 = require("../../../util/regex");
const common_1 = require("./common");
function getPkgProp(pkgInfo, propName) {
    return pkgInfo.childNamed('m:properties')?.childNamed(`d:${propName}`)?.val;
}
async function getReleases(http, feedUrl, pkgName) {
    const dep = {
        releases: [],
    };
    let pkgUrlList = `${feedUrl.replace((0, regex_1.regEx)(/\/+$/), '')}/FindPackagesById()?id=%27${pkgName}%27&$select=Version,IsLatestVersion,ProjectUrl,Published`;
    while (pkgUrlList !== null) {
        // typescript issue
        const pkgVersionsListRaw = await http.get(pkgUrlList);
        const pkgVersionsListDoc = new xmldoc_1.XmlDocument(pkgVersionsListRaw.body);
        const pkgInfoList = pkgVersionsListDoc.childrenNamed('entry');
        for (const pkgInfo of pkgInfoList) {
            const version = getPkgProp(pkgInfo, 'Version');
            const releaseTimestamp = getPkgProp(pkgInfo, 'Published');
            dep.releases.push({
                version: (0, common_1.removeBuildMeta)(`${version}`),
                releaseTimestamp,
            });
            try {
                const pkgIsLatestVersion = getPkgProp(pkgInfo, 'IsLatestVersion');
                if (pkgIsLatestVersion === 'true') {
                    const projectUrl = getPkgProp(pkgInfo, 'ProjectUrl');
                    if (projectUrl) {
                        dep.sourceUrl = (0, common_1.massageUrl)(projectUrl);
                    }
                }
            }
            catch (err) /* istanbul ignore next */ {
                logger_1.logger.debug({ err, pkgName, feedUrl }, `nuget registry failure: can't parse pkg info for project url`);
            }
        }
        const nextPkgUrlListLink = pkgVersionsListDoc
            .childrenNamed('link')
            .find((node) => node.attr.rel === 'next');
        pkgUrlList = nextPkgUrlListLink ? nextPkgUrlListLink.attr.href : null;
    }
    // dep not found if no release, so we can try next registry
    if (dep.releases.length === 0) {
        return null;
    }
    return dep;
}
exports.getReleases = getReleases;
//# sourceMappingURL=v2.js.map