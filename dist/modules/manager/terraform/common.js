"use strict";
// FIXME #12556
/* eslint-disable @typescript-eslint/naming-convention */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerraformResourceTypes = exports.TerraformDependencyTypes = void 0;
// eslint-disable-next-line typescript-enum/no-enum
var TerraformDependencyTypes;
(function (TerraformDependencyTypes) {
    TerraformDependencyTypes["unknown"] = "unknown";
    TerraformDependencyTypes["module"] = "module";
    TerraformDependencyTypes["provider"] = "provider";
    TerraformDependencyTypes["required_providers"] = "required_providers";
    TerraformDependencyTypes["resource"] = "resource";
    TerraformDependencyTypes["terraform_version"] = "terraform_version";
})(TerraformDependencyTypes = exports.TerraformDependencyTypes || (exports.TerraformDependencyTypes = {}));
// eslint-disable-next-line typescript-enum/no-enum
var TerraformResourceTypes;
(function (TerraformResourceTypes) {
    TerraformResourceTypes["unknown"] = "unknown";
    /**
     * https://www.terraform.io/docs/providers/docker/r/container.html
     */
    TerraformResourceTypes["docker_container"] = "docker_container";
    /**
     * https://www.terraform.io/docs/providers/docker/r/image.html
     */
    TerraformResourceTypes["docker_image"] = "docker_image";
    /**
     * https://www.terraform.io/docs/providers/docker/r/service.html
     */
    TerraformResourceTypes["docker_service"] = "docker_service";
    /**
     * https://www.terraform.io/docs/providers/helm/r/release.html
     */
    TerraformResourceTypes["helm_release"] = "helm_release";
    /**
     * https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/workspace
     */
    TerraformResourceTypes["tfe_workspace"] = "tfe_workspace";
})(TerraformResourceTypes = exports.TerraformResourceTypes || (exports.TerraformResourceTypes = {}));
//# sourceMappingURL=common.js.map