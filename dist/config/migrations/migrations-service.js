"use strict";
var _a, _MigrationsService_getMigration;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MigrationsService = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const dequal_1 = require("dequal");
const remove_property_migration_1 = require("./base/remove-property-migration");
const rename_property_migration_1 = require("./base/rename-property-migration");
const automerge_major_migration_1 = require("./custom/automerge-major-migration");
const automerge_migration_1 = require("./custom/automerge-migration");
const automerge_minor_migration_1 = require("./custom/automerge-minor-migration");
const automerge_patch_migration_1 = require("./custom/automerge-patch-migration");
const automerge_type_migration_1 = require("./custom/automerge-type-migration");
const azure_gitlab_automerge_migration_1 = require("./custom/azure-gitlab-automerge-migration");
const base_branch_migration_1 = require("./custom/base-branch-migration");
const binary_source_migration_1 = require("./custom/binary-source-migration");
const branch_name_migration_1 = require("./custom/branch-name-migration");
const branch_prefix_migration_1 = require("./custom/branch-prefix-migration");
const compatibility_migration_1 = require("./custom/compatibility-migration");
const composer_ignore_platform_reqs_migration_1 = require("./custom/composer-ignore-platform-reqs-migration");
const dry_run_migration_1 = require("./custom/dry-run-migration");
const enabled_managers_migration_1 = require("./custom/enabled-managers-migration");
const extends_migration_1 = require("./custom/extends-migration");
const go_mod_tidy_migration_1 = require("./custom/go-mod-tidy-migration");
const host_rules_migration_1 = require("./custom/host-rules-migration");
const ignore_node_modules_migration_1 = require("./custom/ignore-node-modules-migration");
const ignore_npmrc_file_migration_1 = require("./custom/ignore-npmrc-file-migration");
const match_strings_migration_1 = require("./custom/match-strings-migration");
const package_name_migration_1 = require("./custom/package-name-migration");
const package_pattern_migration_1 = require("./custom/package-pattern-migration");
const packages_migration_1 = require("./custom/packages-migration");
const path_rules_migration_1 = require("./custom/path-rules-migration");
const pin_versions_migration_1 = require("./custom/pin-versions-migration");
const post_update_options_migration_1 = require("./custom/post-update-options-migration");
const raise_deprecation_warnings_migration_1 = require("./custom/raise-deprecation-warnings-migration");
const rebase_conflicted_prs_migration_1 = require("./custom/rebase-conflicted-prs-migration");
const rebase_stale_prs_migration_1 = require("./custom/rebase-stale-prs-migration");
const renovate_fork_migration_1 = require("./custom/renovate-fork-migration");
const require_config_migration_1 = require("./custom/require-config-migration");
const required_status_checks_migration_1 = require("./custom/required-status-checks-migration");
const schedule_migration_1 = require("./custom/schedule-migration");
const semantic_commits_migration_1 = require("./custom/semantic-commits-migration");
const separate_major_release_migration_1 = require("./custom/separate-major-release-migration");
const separate_multiple_major_migration_1 = require("./custom/separate-multiple-major-migration");
const suppress_notifications_migration_1 = require("./custom/suppress-notifications-migration");
const trust_level_migration_1 = require("./custom/trust-level-migration");
const unpublish_safe_migration_1 = require("./custom/unpublish-safe-migration");
const upgrade_in_range_migration_1 = require("./custom/upgrade-in-range-migration");
const version_strategy_migration_1 = require("./custom/version-strategy-migration");
class MigrationsService {
    static run(originalConfig) {
        const migratedConfig = {};
        const migrations = this.getMigrations(originalConfig, migratedConfig);
        for (const [key, value] of Object.entries(originalConfig)) {
            migratedConfig[key] ?? (migratedConfig[key] = value);
            const migration = tslib_1.__classPrivateFieldGet(MigrationsService, _a, "m", _MigrationsService_getMigration).call(MigrationsService, migrations, key);
            if (migration) {
                migration.run(value, key);
                if (migration.deprecated) {
                    delete migratedConfig[key];
                }
            }
        }
        return migratedConfig;
    }
    static isMigrated(originalConfig, migratedConfig) {
        return !(0, dequal_1.dequal)(originalConfig, migratedConfig);
    }
    static getMigrations(originalConfig, migratedConfig) {
        const migrations = [];
        for (const propertyName of MigrationsService.removedProperties) {
            migrations.push(new remove_property_migration_1.RemovePropertyMigration(propertyName, originalConfig, migratedConfig));
        }
        for (const [oldPropertyName, newPropertyName,] of MigrationsService.renamedProperties.entries()) {
            migrations.push(new rename_property_migration_1.RenamePropertyMigration(oldPropertyName, newPropertyName, originalConfig, migratedConfig));
        }
        for (const CustomMigration of this.customMigrations) {
            migrations.push(new CustomMigration(originalConfig, migratedConfig));
        }
        return migrations;
    }
}
exports.MigrationsService = MigrationsService;
_a = MigrationsService, _MigrationsService_getMigration = function _MigrationsService_getMigration(migrations, key) {
    return migrations.find((migration) => {
        if (is_1.default.regExp(migration.propertyName)) {
            return migration.propertyName.test(key);
        }
        return migration.propertyName === key;
    });
};
MigrationsService.removedProperties = new Set([
    'deepExtract',
    'gitFs',
    'groupBranchName',
    'groupCommitMessage',
    'groupPrBody',
    'groupPrTitle',
    'lazyGrouping',
    'maintainYarnLock',
    'statusCheckVerify',
    'supportPolicy',
    'yarnCacheFolder',
    'yarnMaintenanceBranchName',
    'yarnMaintenanceCommitMessage',
    'yarnMaintenancePrBody',
    'yarnMaintenancePrTitle',
]);
MigrationsService.renamedProperties = new Map([
    ['endpoints', 'hostRules'],
    ['excludedPackageNames', 'excludePackageNames'],
    ['exposeEnv', 'exposeAllEnv'],
    ['managerBranchPrefix', 'additionalBranchPrefix'],
    ['multipleMajorPrs', 'separateMultipleMajor'],
    ['separatePatchReleases', 'separateMinorPatch'],
    ['versionScheme', 'versioning'],
    ['lookupNameTemplate', 'packageNameTemplate'],
]);
MigrationsService.customMigrations = [
    automerge_major_migration_1.AutomergeMajorMigration,
    automerge_migration_1.AutomergeMigration,
    automerge_minor_migration_1.AutomergeMinorMigration,
    automerge_patch_migration_1.AutomergePatchMigration,
    automerge_type_migration_1.AutomergeTypeMigration,
    azure_gitlab_automerge_migration_1.AzureGitLabAutomergeMigration,
    base_branch_migration_1.BaseBranchMigration,
    binary_source_migration_1.BinarySourceMigration,
    branch_name_migration_1.BranchNameMigration,
    branch_prefix_migration_1.BranchPrefixMigration,
    compatibility_migration_1.CompatibilityMigration,
    composer_ignore_platform_reqs_migration_1.ComposerIgnorePlatformReqsMigration,
    enabled_managers_migration_1.EnabledManagersMigration,
    extends_migration_1.ExtendsMigration,
    go_mod_tidy_migration_1.GoModTidyMigration,
    host_rules_migration_1.HostRulesMigration,
    ignore_node_modules_migration_1.IgnoreNodeModulesMigration,
    ignore_npmrc_file_migration_1.IgnoreNpmrcFileMigration,
    match_strings_migration_1.MatchStringsMigration,
    package_name_migration_1.PackageNameMigration,
    package_pattern_migration_1.PackagePatternMigration,
    packages_migration_1.PackagesMigration,
    path_rules_migration_1.PathRulesMigration,
    pin_versions_migration_1.PinVersionsMigration,
    post_update_options_migration_1.PostUpdateOptionsMigration,
    raise_deprecation_warnings_migration_1.RaiseDeprecationWarningsMigration,
    rebase_conflicted_prs_migration_1.RebaseConflictedPrs,
    rebase_stale_prs_migration_1.RebaseStalePrsMigration,
    renovate_fork_migration_1.RenovateForkMigration,
    required_status_checks_migration_1.RequiredStatusChecksMigration,
    schedule_migration_1.ScheduleMigration,
    semantic_commits_migration_1.SemanticCommitsMigration,
    separate_major_release_migration_1.SeparateMajorReleasesMigration,
    separate_multiple_major_migration_1.SeparateMultipleMajorMigration,
    suppress_notifications_migration_1.SuppressNotificationsMigration,
    trust_level_migration_1.TrustLevelMigration,
    unpublish_safe_migration_1.UnpublishSafeMigration,
    upgrade_in_range_migration_1.UpgradeInRangeMigration,
    version_strategy_migration_1.VersionStrategyMigration,
    dry_run_migration_1.DryRunMigration,
    require_config_migration_1.RequireConfigMigration,
];
//# sourceMappingURL=migrations-service.js.map