"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyseTerraformResource = exports.extractTerraformResource = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const logger_1 = require("../../../logger");
const regex_1 = require("../../../util/regex");
const helm_1 = require("../../datasource/helm");
const extract_1 = require("../dockerfile/extract");
const common_1 = require("./common");
const required_version_1 = require("./required-version");
const util_1 = require("./util");
function applyDockerDependency(dep, value) {
    const dockerDep = (0, extract_1.getDep)(value);
    Object.assign(dep, dockerDep);
}
function extractTerraformResource(startingLine, lines) {
    let lineNumber = startingLine;
    const line = lines[lineNumber];
    const deps = [];
    const managerData = {
        terraformDependencyType: common_1.TerraformDependencyTypes.resource,
    };
    const dep = {
        managerData,
    };
    const typeMatch = util_1.resourceTypeExtractionRegex.exec(line);
    // Sets the resourceType, e.g. "helm_release" 'resource "helm_release" "test_release"'
    managerData.resourceType =
        common_1.TerraformResourceTypes[typeMatch?.groups?.type] ??
            common_1.TerraformResourceTypes.unknown;
    /**
     * Iterates over all lines of the resource to extract the relevant key value pairs,
     * e.g. the chart name for helm charts or the terraform_version for tfe_workspace
     */
    let braceCounter = 0;
    do {
        // istanbul ignore if
        if (lineNumber > lines.length - 1) {
            logger_1.logger.debug(`Malformed Terraform file detected.`);
        }
        const line = lines[lineNumber];
        // istanbul ignore else
        if (is_1.default.string(line)) {
            // `{` will be counted with +1 and `}` with -1. Therefore if we reach braceCounter == 0. We have found the end of the terraform block
            const openBrackets = (line.match((0, regex_1.regEx)(/\{/g)) || []).length;
            const closedBrackets = (line.match((0, regex_1.regEx)(/\}/g)) || []).length;
            braceCounter = braceCounter + openBrackets - closedBrackets;
            const kvMatch = util_1.keyValueExtractionRegex.exec(line);
            if (kvMatch?.groups) {
                switch (kvMatch.groups.key) {
                    case 'chart':
                    case 'image':
                    case 'name':
                    case 'repository':
                        managerData[kvMatch.groups.key] = kvMatch.groups.value;
                        break;
                    case 'version':
                    case 'terraform_version':
                        dep.currentValue = kvMatch.groups.value;
                        break;
                    default:
                        /* istanbul ignore next */
                        break;
                }
            }
        }
        else {
            // stop - something went wrong
            braceCounter = 0;
        }
        lineNumber += 1;
    } while (braceCounter !== 0);
    deps.push(dep);
    // remove last lineNumber addition to not skip a line after the last bracket
    lineNumber -= 1;
    return { lineNumber, dependencies: deps };
}
exports.extractTerraformResource = extractTerraformResource;
function analyseTerraformResource(dep) {
    // istanbul ignore if: should tested?
    if (!dep.managerData) {
        return;
    }
    switch (dep.managerData.resourceType) {
        case common_1.TerraformResourceTypes.docker_container:
            if (dep.managerData.image) {
                applyDockerDependency(dep, dep.managerData.image);
                dep.depType = 'docker_container';
            }
            else {
                dep.skipReason = 'invalid-dependency-specification';
            }
            break;
        case common_1.TerraformResourceTypes.docker_image:
            if (dep.managerData.name) {
                applyDockerDependency(dep, dep.managerData.name);
                dep.depType = 'docker_image';
            }
            else {
                dep.skipReason = 'invalid-dependency-specification';
            }
            break;
        case common_1.TerraformResourceTypes.docker_service:
            if (dep.managerData.image) {
                applyDockerDependency(dep, dep.managerData.image);
                dep.depType = 'docker_service';
            }
            else {
                dep.skipReason = 'invalid-dependency-specification';
            }
            break;
        case common_1.TerraformResourceTypes.helm_release:
            if (!dep.managerData.chart) {
                dep.skipReason = 'invalid-name';
            }
            else if ((0, util_1.checkIfStringIsPath)(dep.managerData.chart)) {
                dep.skipReason = 'local-chart';
            }
            dep.depType = 'helm_release';
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            dep.registryUrls = [dep.managerData.repository];
            dep.depName = dep.managerData.chart;
            dep.datasource = helm_1.HelmDatasource.id;
            break;
        case common_1.TerraformResourceTypes.tfe_workspace:
            if (dep.currentValue) {
                (0, required_version_1.analyseTerraformVersion)(dep);
                dep.depType = 'tfe_workspace';
            }
            else {
                dep.skipReason = 'no-version';
            }
            break;
        default:
            dep.skipReason = 'invalid-value';
            break;
    }
}
exports.analyseTerraformResource = analyseTerraformResource;
//# sourceMappingURL=resources.js.map