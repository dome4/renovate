"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractAllPackageFiles = exports.extractPackageFile = exports.extractFromJob = exports.extractFromServices = exports.extractFromImage = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const js_yaml_1 = require("js-yaml");
const logger_1 = require("../../../logger");
const fs_1 = require("../../../util/fs");
const regex_1 = require("../../../util/regex");
const utils_1 = require("./utils");
function extractFromImage(image) {
    if (is_1.default.undefined(image)) {
        return null;
    }
    let dep = null;
    if (is_1.default.string(image)) {
        dep = (0, utils_1.getGitlabDep)(image);
        dep.depType = 'image';
    }
    else if (is_1.default.string(image?.name)) {
        dep = (0, utils_1.getGitlabDep)(image.name);
        dep.depType = 'image-name';
    }
    return dep;
}
exports.extractFromImage = extractFromImage;
function extractFromServices(services) {
    if (is_1.default.undefined(services)) {
        return [];
    }
    const deps = [];
    for (const service of services) {
        if (is_1.default.string(service)) {
            const dep = (0, utils_1.getGitlabDep)(service);
            dep.depType = 'service-image';
            deps.push(dep);
        }
        else if (is_1.default.string(service?.name)) {
            const dep = (0, utils_1.getGitlabDep)(service.name);
            dep.depType = 'service-image';
            deps.push(dep);
        }
    }
    return deps;
}
exports.extractFromServices = extractFromServices;
function extractFromJob(job) {
    if (is_1.default.undefined(job)) {
        return [];
    }
    const deps = [];
    if (is_1.default.object(job)) {
        const { image, services } = { ...job };
        if (is_1.default.object(image) || is_1.default.string(image)) {
            const dep = extractFromImage(image);
            if (dep) {
                deps.push(dep);
            }
        }
        if (is_1.default.array(services)) {
            deps.push(...extractFromServices(services));
        }
    }
    return deps;
}
exports.extractFromJob = extractFromJob;
function extractPackageFile(content) {
    let deps = [];
    try {
        const doc = (0, js_yaml_1.load)((0, utils_1.replaceReferenceTags)(content), {
            json: true,
        });
        if (is_1.default.object(doc)) {
            for (const [property, value] of Object.entries(doc)) {
                switch (property) {
                    case 'image':
                        {
                            const dep = extractFromImage(value);
                            if (dep) {
                                deps.push(dep);
                            }
                        }
                        break;
                    case 'services':
                        deps.push(...extractFromServices(value));
                        break;
                    default:
                        deps.push(...extractFromJob(value));
                        break;
                }
            }
            deps = deps.filter(is_1.default.truthy);
        }
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.warn({ err }, 'Error extracting GitLab CI dependencies');
    }
    return deps.length ? { deps } : null;
}
exports.extractPackageFile = extractPackageFile;
async function extractAllPackageFiles(_config, packageFiles) {
    const filesToExamine = [...packageFiles];
    const seen = new Set(packageFiles);
    const results = [];
    // extract all includes from the files
    while (filesToExamine.length > 0) {
        const file = filesToExamine.pop();
        const content = await (0, fs_1.readLocalFile)(file, 'utf8');
        if (!content) {
            logger_1.logger.debug({ file }, 'Empty or non existent gitlabci file');
            continue;
        }
        let doc;
        try {
            doc = (0, js_yaml_1.load)((0, utils_1.replaceReferenceTags)(content), {
                json: true,
            });
        }
        catch (err) {
            logger_1.logger.warn({ err, file }, 'Error extracting GitLab CI dependencies');
            continue;
        }
        if (is_1.default.array(doc?.include)) {
            for (const includeObj of doc.include) {
                if (is_1.default.string(includeObj.local)) {
                    const fileObj = includeObj.local.replace((0, regex_1.regEx)(/^\//), '');
                    if (!seen.has(fileObj)) {
                        seen.add(fileObj);
                        filesToExamine.push(fileObj);
                    }
                }
            }
        }
        else if (is_1.default.string(doc?.include)) {
            const fileObj = doc.include.replace((0, regex_1.regEx)(/^\//), '');
            if (!seen.has(fileObj)) {
                seen.add(fileObj);
                filesToExamine.push(fileObj);
            }
        }
        const result = extractPackageFile(content);
        if (result !== null) {
            results.push({
                packageFile: file,
                deps: result.deps,
            });
        }
    }
    logger_1.logger.trace({ packageFiles, files: filesToExamine.entries() }, 'extracted all GitLab CI files');
    if (!results.length) {
        return null;
    }
    return results;
}
exports.extractAllPackageFiles = extractAllPackageFiles;
//# sourceMappingURL=extract.js.map