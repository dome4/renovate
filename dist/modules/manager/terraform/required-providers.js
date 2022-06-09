"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeTerraformRequiredProvider = exports.extractTerraformRequiredProviders = exports.providerBlockExtractionRegex = void 0;
const regex_1 = require("../../../util/regex");
const common_1 = require("./common");
const providers_1 = require("./providers");
const util_1 = require("./util");
exports.providerBlockExtractionRegex = (0, regex_1.regEx)(/^\s*(?<key>[^\s]+)\s+=\s+{/);
function extractBlock(lineNum, lines, dep) {
    let lineNumber = lineNum;
    let line;
    do {
        lineNumber += 1;
        line = lines[lineNumber];
        const kvMatch = util_1.keyValueExtractionRegex.exec(line);
        if (kvMatch?.groups) {
            switch (kvMatch.groups.key) {
                case 'source':
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                    dep.managerData.source = kvMatch.groups.value;
                    break;
                case 'version':
                    dep.currentValue = kvMatch.groups.value;
                    break;
                /* istanbul ignore next */
                default:
                    break;
            }
        }
    } while (line.trim() !== '}');
    return lineNumber;
}
function extractTerraformRequiredProviders(startingLine, lines) {
    let lineNumber = startingLine;
    let line;
    const deps = [];
    do {
        const dep = {
            managerData: {
                terraformDependencyType: common_1.TerraformDependencyTypes.required_providers,
            },
        };
        lineNumber += 1;
        line = lines[lineNumber];
        const kvMatch = util_1.keyValueExtractionRegex.exec(line);
        if (kvMatch?.groups) {
            dep.currentValue = kvMatch.groups.value;
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            dep.managerData.moduleName = kvMatch.groups.key;
            deps.push(dep);
        }
        else {
            const nameMatch = exports.providerBlockExtractionRegex.exec(line);
            if (nameMatch?.groups) {
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                dep.managerData.moduleName = nameMatch.groups.key;
                lineNumber = extractBlock(lineNumber, lines, dep);
                deps.push(dep);
            }
        }
    } while (line.trim() !== '}');
    return { lineNumber, dependencies: deps };
}
exports.extractTerraformRequiredProviders = extractTerraformRequiredProviders;
function analyzeTerraformRequiredProvider(dep, locks) {
    (0, providers_1.analyzeTerraformProvider)(dep, locks);
    dep.depType = `required_provider`;
}
exports.analyzeTerraformRequiredProvider = analyzeTerraformRequiredProvider;
//# sourceMappingURL=required-providers.js.map