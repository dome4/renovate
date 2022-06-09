"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPackageFile = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const js_yaml_1 = require("js-yaml");
const logger_1 = require("../../../logger");
const fs_1 = require("../../../util/fs");
const helm_1 = require("../../datasource/helm");
const utils_1 = require("./utils");
async function extractPackageFile(content, fileName, config) {
    let chart;
    try {
        // TODO: fix me (#9610)
        chart = (0, js_yaml_1.load)(content, { json: true });
        if (!(chart?.apiVersion && chart.name && chart.version)) {
            logger_1.logger.debug({ fileName }, 'Failed to find required fields in Chart.yaml');
            return null;
        }
        if (chart.apiVersion !== 'v2') {
            logger_1.logger.debug({ fileName }, 'Unsupported Chart apiVersion. Only v2 is supported.');
            return null;
        }
    }
    catch (err) {
        logger_1.logger.debug({ fileName }, 'Failed to parse helm Chart.yaml');
        return null;
    }
    const packageFileVersion = chart.version;
    let deps = [];
    if (!is_1.default.nonEmptyArray(chart?.dependencies)) {
        logger_1.logger.debug({ fileName }, 'Chart has no dependencies');
        return null;
    }
    const validDependencies = chart.dependencies.filter((dep) => is_1.default.nonEmptyString(dep.name) && is_1.default.nonEmptyString(dep.version));
    if (!is_1.default.nonEmptyArray(validDependencies)) {
        logger_1.logger.debug('Name and/or version missing for all dependencies');
        return null;
    }
    deps = validDependencies.map((dep) => {
        const res = {
            depName: dep.name,
            currentValue: dep.version,
        };
        if (!dep.repository) {
            res.skipReason = 'no-repository';
            return res;
        }
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        const repository = (0, utils_1.resolveAlias)(dep.repository, config.aliases);
        if (!repository) {
            res.skipReason = 'placeholder-url';
            return res;
        }
        const result = {
            ...res,
            ...(0, utils_1.parseRepository)(dep.name, repository),
        };
        return result;
    });
    const res = {
        deps,
        datasource: helm_1.HelmDatasource.id,
        packageFileVersion,
    };
    const lockFileName = (0, fs_1.getSiblingFileName)(fileName, 'Chart.lock');
    // istanbul ignore if
    if (await (0, fs_1.localPathExists)(lockFileName)) {
        res.lockFiles = [lockFileName];
    }
    return res;
}
exports.extractPackageFile = extractPackageFile;
//# sourceMappingURL=extract.js.map