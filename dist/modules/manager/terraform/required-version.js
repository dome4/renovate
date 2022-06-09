"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyseTerraformVersion = exports.extractTerraformRequiredVersion = void 0;
const logger_1 = require("../../../logger");
const regex_1 = require("../../../util/regex");
const github_releases_1 = require("../../datasource/github-releases");
const common_1 = require("./common");
const util_1 = require("./util");
function extractTerraformRequiredVersion(startingLine, lines) {
    const deps = [];
    let lineNumber = startingLine;
    let braceCounter = 0;
    do {
        // istanbul ignore if
        if (lineNumber > lines.length - 1) {
            logger_1.logger.debug(`Malformed Terraform file detected.`);
        }
        const line = lines[lineNumber];
        // `{` will be counted wit +1 and `}` with -1. Therefore if we reach braceCounter == 0. We have found the end of the terraform block
        const openBrackets = (line.match((0, regex_1.regEx)(/\{/g)) || []).length;
        const closedBrackets = (line.match((0, regex_1.regEx)(/\}/g)) || []).length;
        braceCounter = braceCounter + openBrackets - closedBrackets;
        const kvMatch = util_1.keyValueExtractionRegex.exec(line);
        if (kvMatch?.groups && kvMatch.groups.key === 'required_version') {
            const dep = {
                currentValue: kvMatch.groups.value,
                lineNumber,
                managerData: {
                    terraformDependencyType: common_1.TerraformDependencyTypes.terraform_version,
                },
            };
            deps.push(dep);
            // returning starting line as required_providers are also in the terraform block
            // if we would return the position of the required_version line we would potentially skip the providers
            return { lineNumber: startingLine, dependencies: deps };
        }
        lineNumber += 1;
    } while (braceCounter !== 0);
    return null;
}
exports.extractTerraformRequiredVersion = extractTerraformRequiredVersion;
function analyseTerraformVersion(dep) {
    dep.depType = 'required_version';
    dep.datasource = github_releases_1.GithubReleasesDatasource.id;
    dep.depName = 'hashicorp/terraform';
    dep.extractVersion = 'v(?<version>.*)$';
}
exports.analyseTerraformVersion = analyseTerraformVersion;
//# sourceMappingURL=required-version.js.map