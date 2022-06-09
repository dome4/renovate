"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeExtractionTemplate = exports.mergeGroups = exports.regexMatchAll = exports.createDependency = exports.validMatchFields = void 0;
const tslib_1 = require("tslib");
const url_1 = require("url");
const logger_1 = require("../../../logger");
const template = tslib_1.__importStar(require("../../../util/template"));
exports.validMatchFields = [
    'depName',
    'packageName',
    'currentValue',
    'currentDigest',
    'datasource',
    'versioning',
    'extractVersion',
    'registryUrl',
    'depType',
];
function createDependency(extractionTemplate, config, dep) {
    const dependency = dep || {};
    const { groups, replaceString } = extractionTemplate;
    function updateDependency(field, value) {
        switch (field) {
            case 'registryUrl':
                // check if URL is valid and pack inside an array
                try {
                    const url = new url_1.URL(value).toString();
                    dependency.registryUrls = [url];
                }
                catch (err) {
                    logger_1.logger.warn({ value }, 'Invalid regex manager registryUrl');
                }
                break;
            default:
                dependency[field] = value;
                break;
        }
    }
    for (const field of exports.validMatchFields) {
        const fieldTemplate = `${field}Template`;
        const tmpl = config[fieldTemplate];
        if (tmpl) {
            try {
                const compiled = template.compile(tmpl, groups, false);
                updateDependency(field, compiled);
            }
            catch (err) {
                logger_1.logger.warn({ template: tmpl }, 'Error compiling template for custom manager');
                return null;
            }
        }
        else if (groups[field]) {
            updateDependency(field, groups[field]);
        }
    }
    dependency.replaceString = replaceString;
    return dependency;
}
exports.createDependency = createDependency;
function regexMatchAll(regex, content) {
    const matches = [];
    let matchResult;
    do {
        matchResult = regex.exec(content);
        if (matchResult) {
            matches.push(matchResult);
        }
    } while (matchResult);
    return matches;
}
exports.regexMatchAll = regexMatchAll;
function mergeGroups(mergedGroup, secondGroup) {
    return { ...mergedGroup, ...secondGroup };
}
exports.mergeGroups = mergeGroups;
function mergeExtractionTemplate(base, addition) {
    return {
        groups: mergeGroups(base.groups, addition.groups),
        replaceString: addition.replaceString ?? base.replaceString,
    };
}
exports.mergeExtractionTemplate = mergeExtractionTemplate;
//# sourceMappingURL=utils.js.map