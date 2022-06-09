"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectMonorepos = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const logger_1 = require("../../../../logger");
const fs_1 = require("../../../../util/fs");
const pnpm_1 = require("./pnpm");
const utils_1 = require("./utils");
async function detectMonorepos(packageFiles) {
    await (0, pnpm_1.detectPnpmWorkspaces)(packageFiles);
    logger_1.logger.debug('Detecting Lerna and Yarn Workspaces');
    for (const p of packageFiles) {
        const { packageFile, npmLock, yarnLock, npmrc, managerData = {}, lernaClient, lernaPackages, yarnWorkspacesPackages, skipInstalls, } = p;
        const { lernaJsonFile, yarnZeroInstall } = managerData;
        const packages = yarnWorkspacesPackages || lernaPackages;
        if (packages?.length) {
            const internalPackagePatterns = (is_1.default.array(packages) ? packages : [packages])
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                .map((pattern) => (0, fs_1.getSiblingFileName)(packageFile, pattern));
            const internalPackageFiles = packageFiles.filter((sp) => (0, utils_1.matchesAnyPattern)(
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            (0, fs_1.getSubDirectory)(sp.packageFile), internalPackagePatterns));
            const internalPackageNames = internalPackageFiles
                .map((sp) => sp.packageJsonName)
                .filter(Boolean);
            p.deps?.forEach((dep) => {
                if (internalPackageNames.includes(dep.depName)) {
                    dep.isInternal = true;
                }
            });
            for (const subPackage of internalPackageFiles) {
                subPackage.managerData = subPackage.managerData || {};
                subPackage.managerData.lernaJsonFile = lernaJsonFile;
                subPackage.managerData.yarnZeroInstall = yarnZeroInstall;
                subPackage.lernaClient = lernaClient;
                subPackage.yarnLock = subPackage.yarnLock || yarnLock;
                subPackage.npmLock = subPackage.npmLock || npmLock;
                subPackage.skipInstalls = skipInstalls && subPackage.skipInstalls; // skip if both are true
                if (subPackage.yarnLock) {
                    subPackage.hasYarnWorkspaces = !!yarnWorkspacesPackages;
                    subPackage.npmrc = subPackage.npmrc || npmrc;
                }
                subPackage.deps?.forEach((dep) => {
                    if (internalPackageNames.includes(dep.depName)) {
                        dep.isInternal = true;
                    }
                });
            }
        }
    }
}
exports.detectMonorepos = detectMonorepos;
//# sourceMappingURL=monorepo.js.map