"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPackageFile = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const js_yaml_1 = require("js-yaml");
const logger_1 = require("../../../logger");
const regex_1 = require("../../../util/regex");
const docker_1 = require("../../datasource/docker");
const helm_1 = require("../../datasource/helm");
const isValidChartName = (name) => !!name && !(0, regex_1.regEx)(/[!@#$%^&*(),.?":{}/|<>A-Z]/).test(name);
function extractYaml(content) {
    // regex remove go templated ({{ . }}) values
    return content.replace(/(^|:)\s*{{.+}}\s*$/gm, '$1');
}
function extractPackageFile(content, fileName, config) {
    let deps = [];
    let docs;
    const aliases = {};
    try {
        docs = (0, js_yaml_1.loadAll)(extractYaml(content), null, { json: true });
    }
    catch (err) {
        logger_1.logger.debug({ err, fileName }, 'Failed to parse helmfile helmfile.yaml');
        return null;
    }
    for (const doc of docs) {
        if (!(doc && is_1.default.array(doc.releases))) {
            continue;
        }
        if (doc.repositories) {
            for (let i = 0; i < doc.repositories.length; i += 1) {
                aliases[doc.repositories[i].name] = doc.repositories[i].url;
            }
        }
        logger_1.logger.debug({ aliases }, 'repositories discovered.');
        deps = doc.releases.map((dep) => {
            let depName = dep.chart;
            let repoName = null;
            if (!is_1.default.string(dep.chart)) {
                return {
                    depName: dep.name,
                    skipReason: 'invalid-name',
                };
            }
            // If starts with ./ is for sure a local path
            if (dep.chart.startsWith('./')) {
                return {
                    depName: dep.name,
                    skipReason: 'local-chart',
                };
            }
            if (is_1.default.number(dep.version)) {
                dep.version = String(dep.version);
            }
            if (dep.chart.includes('/')) {
                const v = dep.chart.split('/');
                repoName = v.shift();
                depName = v.join('/');
            }
            else {
                repoName = dep.chart;
            }
            if (!is_1.default.string(dep.version)) {
                return {
                    depName,
                    skipReason: 'invalid-version',
                };
            }
            const res = {
                depName,
                currentValue: dep.version,
                registryUrls: [aliases[repoName]]
                    .concat([config.aliases?.[repoName]])
                    .filter(is_1.default.string),
            };
            // in case of OCI repository, we need a PackageDependency with a DockerDatasource and a packageName
            const repository = doc.repositories?.find((repo) => repo.name === repoName);
            if (repository?.oci) {
                res.datasource = docker_1.DockerDatasource.id;
                res.packageName = aliases[repoName] + '/' + depName;
            }
            // By definition on helm the chart name should be lowercase letter + number + -
            // However helmfile support templating of that field
            if (!isValidChartName(res.depName)) {
                res.skipReason = 'unsupported-chart-type';
            }
            // Skip in case we cannot locate the registry
            if (is_1.default.emptyArray(res.registryUrls)) {
                res.skipReason = 'unknown-registry';
            }
            return res;
        });
    }
    return deps.length ? { deps, datasource: helm_1.HelmDatasource.id } : null;
}
exports.extractPackageFile = extractPackageFile;
//# sourceMappingURL=extract.js.map