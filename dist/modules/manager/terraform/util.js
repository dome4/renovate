"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLockedVersion = exports.massageProviderLookupName = exports.checkIfStringIsPath = exports.checkFileContainsDependency = exports.getTerraformDependencyType = exports.resourceTypeExtractionRegex = exports.keyValueExtractionRegex = void 0;
const regex_1 = require("../../../util/regex");
const terraform_provider_1 = require("../../datasource/terraform-provider");
const common_1 = require("./common");
exports.keyValueExtractionRegex = (0, regex_1.regEx)(/^\s*(?<key>[^\s]+)\s+=\s+"(?<value>[^"]+)"\s*$/);
exports.resourceTypeExtractionRegex = (0, regex_1.regEx)(/^\s*resource\s+"(?<type>[^\s]+)"\s+"(?<name>[^"]+)"\s*{/);
function getTerraformDependencyType(value) {
    switch (value) {
        case 'module': {
            return common_1.TerraformDependencyTypes.module;
        }
        case 'provider': {
            return common_1.TerraformDependencyTypes.provider;
        }
        case 'required_providers': {
            return common_1.TerraformDependencyTypes.required_providers;
        }
        case 'resource': {
            return common_1.TerraformDependencyTypes.resource;
        }
        case 'terraform': {
            return common_1.TerraformDependencyTypes.terraform_version;
        }
        default: {
            return common_1.TerraformDependencyTypes.unknown;
        }
    }
}
exports.getTerraformDependencyType = getTerraformDependencyType;
function checkFileContainsDependency(content, checkList) {
    return checkList.some((check) => content.includes(check));
}
exports.checkFileContainsDependency = checkFileContainsDependency;
const pathStringRegex = (0, regex_1.regEx)(/(.|..)?(\/[^/])+/);
function checkIfStringIsPath(path) {
    const match = pathStringRegex.exec(path);
    return !!match;
}
exports.checkIfStringIsPath = checkIfStringIsPath;
function massageProviderLookupName(dep) {
    if (!dep.packageName) {
        dep.packageName = dep.depName;
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    if (!dep.packageName.includes('/')) {
        dep.packageName = `hashicorp/${dep.packageName}`;
    }
    // handle cases like `Telmate/proxmox`
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    dep.packageName = dep.packageName.toLowerCase();
}
exports.massageProviderLookupName = massageProviderLookupName;
function getLockedVersion(dep, locks) {
    const depRegistryUrl = dep.registryUrls
        ? dep.registryUrls[0]
        : terraform_provider_1.TerraformProviderDatasource.defaultRegistryUrls[0];
    const foundLock = locks.find((lock) => lock.packageName === dep.packageName &&
        lock.registryUrl === depRegistryUrl);
    if (foundLock) {
        return foundLock.version;
    }
    return undefined;
}
exports.getLockedVersion = getLockedVersion;
//# sourceMappingURL=util.js.map