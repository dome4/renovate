"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPackageFile = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const js_yaml_1 = require("js-yaml");
const logger_1 = require("../../../logger");
const ignore_1 = require("../../../util/ignore");
const regex_1 = require("../../../util/regex");
const jenkins_plugins_1 = require("../../datasource/jenkins-plugins");
const mavenVersioning = tslib_1.__importStar(require("../../versioning/maven"));
const YamlExtension = (0, regex_1.regEx)(/\.ya?ml$/);
function getDependency(plugin) {
    const dep = {
        datasource: jenkins_plugins_1.JenkinsPluginsDatasource.id,
        versioning: mavenVersioning.id,
        depName: plugin.artifactId,
    };
    if (plugin.source?.version) {
        dep.currentValue = plugin.source.version.toString();
        if (typeof plugin.source.version !== 'string') {
            dep.skipReason = 'invalid-version';
            logger_1.logger.warn({ dep }, 'Jenkins plugin dependency version is not a string and will be ignored');
        }
    }
    else {
        dep.skipReason = 'no-version';
    }
    if (plugin.source?.version === 'latest' ||
        plugin.source?.version === 'experimental' ||
        plugin.groupId) {
        dep.skipReason = 'unsupported-version';
    }
    if (plugin.source?.url) {
        dep.skipReason = 'internal-package';
    }
    if (!dep.skipReason && plugin.renovate?.ignore) {
        dep.skipReason = 'ignored';
    }
    logger_1.logger.debug({ dep }, 'Jenkins plugin dependency');
    return dep;
}
function extractYaml(content) {
    const deps = [];
    try {
        const doc = (0, js_yaml_1.load)(content, { json: true });
        if (is_1.default.nonEmptyArray(doc?.plugins)) {
            for (const plugin of doc.plugins) {
                if (plugin.artifactId) {
                    const dep = getDependency(plugin);
                    deps.push(dep);
                }
            }
        }
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.warn({ err }, 'Error parsing Jenkins plugins');
    }
    return deps;
}
function extractText(content) {
    const deps = [];
    const regex = (0, regex_1.regEx)(/^\s*(?<depName>[\d\w-]+):(?<currentValue>[^#\s]+)[#\s]*(?<comment>.*)$/);
    for (const line of content.split(regex_1.newlineRegex)) {
        const match = regex.exec(line);
        if (match?.groups) {
            const { depName, currentValue, comment } = match.groups;
            const plugin = {
                artifactId: depName,
                source: {
                    version: currentValue,
                },
                renovate: {
                    ignore: (0, ignore_1.isSkipComment)(comment),
                },
            };
            const dep = getDependency(plugin);
            deps.push(dep);
        }
    }
    return deps;
}
function extractPackageFile(content, fileName) {
    logger_1.logger.trace('jenkins.extractPackageFile()');
    const deps = [];
    if (YamlExtension.test(fileName)) {
        deps.push(...extractYaml(content));
    }
    else {
        deps.push(...extractText(content));
    }
    if (deps.length === 0) {
        return null;
    }
    return { deps };
}
exports.extractPackageFile = extractPackageFile;
//# sourceMappingURL=extract.js.map