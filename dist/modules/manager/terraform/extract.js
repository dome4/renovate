"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPackageFile = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const logger_1 = require("../../../logger");
const regex_1 = require("../../../util/regex");
const common_1 = require("./common");
const util_1 = require("./lockfile/util");
const modules_1 = require("./modules");
const providers_1 = require("./providers");
const required_providers_1 = require("./required-providers");
const required_version_1 = require("./required-version");
const resources_1 = require("./resources");
const util_2 = require("./util");
const dependencyBlockExtractionRegex = (0, regex_1.regEx)(/^\s*(?<type>[a-z_]+)\s+("(?<packageName>[^"]+)"\s+)?("(?<terraformName>[^"]+)"\s+)?{\s*$/);
const contentCheckList = [
    'module "',
    'provider "',
    'required_providers ',
    ' "helm_release" ',
    ' "docker_image" ',
    'required_version',
    'terraform_version', // part of  tfe_workspace
];
async function extractPackageFile(content, fileName, config) {
    logger_1.logger.trace({ content }, 'terraform.extractPackageFile()');
    if (!(0, util_2.checkFileContainsDependency)(content, contentCheckList)) {
        logger_1.logger.trace({ fileName }, 'preflight content check has not found any relevant content');
        return null;
    }
    let deps = [];
    try {
        const lines = content.split(regex_1.newlineRegex);
        for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
            const line = lines[lineNumber];
            const terraformDependency = dependencyBlockExtractionRegex.exec(line);
            if (terraformDependency?.groups) {
                logger_1.logger.trace(`Matched ${terraformDependency.groups.type} on line ${lineNumber}`);
                const tfDepType = (0, util_2.getTerraformDependencyType)(terraformDependency.groups.type);
                let result = null;
                switch (tfDepType) {
                    case common_1.TerraformDependencyTypes.required_providers: {
                        result = (0, required_providers_1.extractTerraformRequiredProviders)(lineNumber, lines);
                        break;
                    }
                    case common_1.TerraformDependencyTypes.provider: {
                        result = (0, providers_1.extractTerraformProvider)(lineNumber, lines, terraformDependency.groups.packageName);
                        break;
                    }
                    case common_1.TerraformDependencyTypes.module: {
                        result = (0, modules_1.extractTerraformModule)(lineNumber, lines, terraformDependency.groups.packageName);
                        break;
                    }
                    case common_1.TerraformDependencyTypes.resource: {
                        result = (0, resources_1.extractTerraformResource)(lineNumber, lines);
                        break;
                    }
                    case common_1.TerraformDependencyTypes.terraform_version: {
                        result = (0, required_version_1.extractTerraformRequiredVersion)(lineNumber, lines);
                        break;
                    }
                    /* istanbul ignore next */
                    default:
                        logger_1.logger.trace(`Could not identify TerraformDependencyType ${terraformDependency.groups.type} on line ${lineNumber}.`);
                        break;
                }
                if (result) {
                    lineNumber = result.lineNumber;
                    deps = deps.concat(result.dependencies);
                    result = null;
                }
            }
        }
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.warn({ err }, 'Error extracting terraform plugins');
    }
    const locks = [];
    const lockFilePath = (0, util_1.findLockFile)(fileName);
    if (lockFilePath) {
        const lockFileContent = await (0, util_1.readLockFile)(lockFilePath);
        if (lockFileContent) {
            const extractedLocks = (0, util_1.extractLocks)(lockFileContent);
            if (is_1.default.nonEmptyArray(extractedLocks)) {
                locks.push(...extractedLocks);
            }
        }
    }
    deps.forEach((dep) => {
        switch (dep.managerData?.terraformDependencyType) {
            case common_1.TerraformDependencyTypes.required_providers:
                (0, required_providers_1.analyzeTerraformRequiredProvider)(dep, locks);
                break;
            case common_1.TerraformDependencyTypes.provider:
                (0, providers_1.analyzeTerraformProvider)(dep, locks);
                break;
            case common_1.TerraformDependencyTypes.module:
                (0, modules_1.analyseTerraformModule)(dep);
                break;
            case common_1.TerraformDependencyTypes.resource:
                (0, resources_1.analyseTerraformResource)(dep);
                break;
            case common_1.TerraformDependencyTypes.terraform_version:
                (0, required_version_1.analyseTerraformVersion)(dep);
                break;
            /* istanbul ignore next */
            default:
        }
        delete dep.managerData;
    });
    if (deps.some((dep) => dep.skipReason !== 'local')) {
        return { deps };
    }
    return null;
}
exports.extractPackageFile = extractPackageFile;
//# sourceMappingURL=extract.js.map