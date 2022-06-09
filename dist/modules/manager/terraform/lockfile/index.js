"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateArtifacts = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const p_map_1 = tslib_1.__importDefault(require("p-map"));
const logger_1 = require("../../../../logger");
const datasource_1 = require("../../../datasource");
const terraform_provider_1 = require("../../../datasource/terraform-provider");
const versioning_1 = require("../../../versioning");
const util_1 = require("../util");
const hash_1 = require("./hash");
const util_2 = require("./util");
async function updateAllLocks(locks) {
    const updates = await (0, p_map_1.default)(locks, async (lock) => {
        const updateConfig = {
            versioning: 'hashicorp',
            datasource: 'terraform-provider',
            depName: lock.packageName,
        };
        const { releases } = (await (0, datasource_1.getPkgReleases)(updateConfig)) ?? {};
        // istanbul ignore if: needs test
        if (!releases) {
            return null;
        }
        const versioning = (0, versioning_1.get)(updateConfig.versioning);
        const versionsList = releases.map((release) => release.version);
        const newVersion = versioning.getSatisfyingVersion(versionsList, lock.constraints);
        // if the new version is the same as the last, signal that no update is needed
        if (!newVersion || newVersion === lock.version) {
            return null;
        }
        const update = {
            newVersion,
            newConstraint: lock.constraints,
            newHashes: (await hash_1.TerraformProviderHash.createHashes(lock.registryUrl, lock.packageName, newVersion)) ?? [],
            ...lock,
        };
        return update;
    }, { concurrency: 4 } // allow to look up 4 lock in parallel
    );
    return updates.filter(is_1.default.truthy);
}
async function updateArtifacts({ packageFileName, updatedDeps, config, }) {
    logger_1.logger.debug(`terraform.updateArtifacts(${packageFileName})`);
    const lockFilePath = (0, util_2.findLockFile)(packageFileName);
    try {
        const lockFileContent = await (0, util_2.readLockFile)(lockFilePath);
        if (!lockFileContent) {
            logger_1.logger.debug('No .terraform.lock.hcl found');
            return null;
        }
        const locks = (0, util_2.extractLocks)(lockFileContent);
        if (!locks) {
            logger_1.logger.debug('No Locks in .terraform.lock.hcl found');
            return null;
        }
        const updates = [];
        if (config.updateType === 'lockFileMaintenance') {
            // update all locks in the file during maintenance --> only update version in constraints
            const maintenanceUpdates = await updateAllLocks(locks);
            updates.push(...maintenanceUpdates);
        }
        else {
            const providerDeps = updatedDeps.filter((dep) => 
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            ['provider', 'required_provider'].includes(dep.depType));
            for (const dep of providerDeps) {
                (0, util_1.massageProviderLookupName)(dep);
                const { registryUrls, newVersion, newValue, packageName } = dep;
                const registryUrl = registryUrls
                    ? registryUrls[0]
                    : terraform_provider_1.TerraformProviderDatasource.defaultRegistryUrls[0];
                const newConstraint = (0, util_2.isPinnedVersion)(newValue) ? newVersion : newValue;
                const updateLock = locks.find((value) => value.packageName === packageName);
                // istanbul ignore if: needs test
                if (!updateLock) {
                    continue;
                }
                const update = {
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                    newVersion: newVersion,
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                    newConstraint: newConstraint,
                    newHashes: (await hash_1.TerraformProviderHash.createHashes(registryUrl, updateLock.packageName, 
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                    newVersion)) ?? /* istanbul ignore next: needs test */ [],
                    ...updateLock,
                };
                updates.push(update);
            }
        }
        // if no updates have been found or there are failed hashes abort
        if (updates.length === 0 ||
            updates.some((value) => !value.newHashes?.length)) {
            return null;
        }
        const res = (0, util_2.writeLockUpdates)(updates, lockFilePath, lockFileContent);
        return [res];
    }
    catch (err) {
        /* istanbul ignore next */
        return [
            {
                artifactError: {
                    lockFile: lockFilePath,
                    stderr: err.message,
                },
            },
        ];
    }
}
exports.updateArtifacts = updateArtifacts;
//# sourceMappingURL=index.js.map