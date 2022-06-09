"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPackageFile = void 0;
const logger_1 = require("../../../logger");
const regex_1 = require("../../../util/regex");
const extract_1 = require("../dockerfile/extract");
function extractPackageFile(content) {
    logger_1.logger.trace('kubernetes.extractPackageFile()');
    let deps = [];
    const isKubernetesManifest = (0, regex_1.regEx)(/\s*apiVersion\s*:/).test(content) &&
        (0, regex_1.regEx)(/\s*kind\s*:/).test(content);
    if (!isKubernetesManifest) {
        return null;
    }
    for (const line of content.split(regex_1.newlineRegex)) {
        const match = (0, regex_1.regEx)(/^\s*-?\s*image:\s*'?"?([^\s'"]+)'?"?\s*$/).exec(line);
        if (match) {
            const currentFrom = match[1];
            const dep = (0, extract_1.getDep)(currentFrom);
            logger_1.logger.debug({
                depName: dep.depName,
                currentValue: dep.currentValue,
                currentDigest: dep.currentDigest,
            }, 'Kubernetes image');
            deps.push(dep);
        }
    }
    deps = deps.filter((dep) => !dep.currentValue?.includes('${'));
    if (!deps.length) {
        return null;
    }
    return { deps };
}
exports.extractPackageFile = extractPackageFile;
//# sourceMappingURL=extract.js.map