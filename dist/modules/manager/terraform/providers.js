"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeTerraformProvider = exports.extractTerraformProvider = exports.sourceExtractionRegex = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const logger_1 = require("../../../logger");
const regex_1 = require("../../../util/regex");
const terraform_provider_1 = require("../../datasource/terraform-provider");
const common_1 = require("./common");
const util_1 = require("./util");
exports.sourceExtractionRegex = (0, regex_1.regEx)(/^(?:(?<hostname>(?:[a-zA-Z0-9]+\.+)+[a-zA-Z0-9]+)\/)?(?:(?<namespace>[^/]+)\/)?(?<type>[^/]+)/);
function extractTerraformProvider(startingLine, lines, moduleName) {
    let lineNumber = startingLine;
    const deps = [];
    const dep = {
        managerData: {
            moduleName,
            terraformDependencyType: common_1.TerraformDependencyTypes.provider,
        },
    };
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
            // only update fields inside the root block
            if (braceCounter === 1) {
                const kvMatch = util_1.keyValueExtractionRegex.exec(line);
                if (kvMatch?.groups) {
                    if (kvMatch.groups.key === 'version') {
                        dep.currentValue = kvMatch.groups.value;
                    }
                    else if (kvMatch.groups.key === 'source') {
                        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                        dep.managerData.source = kvMatch.groups.value;
                        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                        dep.managerData.sourceLine = lineNumber;
                    }
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
exports.extractTerraformProvider = extractTerraformProvider;
function analyzeTerraformProvider(dep, locks) {
    dep.depType = 'provider';
    dep.depName = dep.managerData?.moduleName;
    dep.datasource = terraform_provider_1.TerraformProviderDatasource.id;
    if (is_1.default.nonEmptyString(dep.managerData?.source)) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        const source = exports.sourceExtractionRegex.exec(dep.managerData.source);
        if (!source?.groups) {
            dep.skipReason = 'unsupported-url';
            return;
        }
        // buildin providers https://github.com/terraform-providers
        if (source.groups.namespace === 'terraform-providers') {
            dep.registryUrls = [`https://releases.hashicorp.com`];
        }
        else if (source.groups.hostname) {
            dep.registryUrls = [`https://${source.groups.hostname}`];
            dep.packageName = `${source.groups.namespace}/${source.groups.type}`;
        }
        else {
            dep.packageName = dep.managerData?.source;
        }
    }
    (0, util_1.massageProviderLookupName)(dep);
    dep.lockedVersion = (0, util_1.getLockedVersion)(dep, locks);
    if (!dep.currentValue) {
        dep.skipReason = 'no-version';
    }
}
exports.analyzeTerraformProvider = analyzeTerraformProvider;
//# sourceMappingURL=providers.js.map