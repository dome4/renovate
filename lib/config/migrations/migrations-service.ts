import is from '@sindresorhus/is';
import { dequal } from 'dequal';
import type { RenovateConfig } from '../types';
import { RemovePropertyMigration } from './base/remove-property-migration';
import { RenamePropertyMigration } from './base/rename-property-migration';
import { AutomergeMajorMigration } from './custom/automerge-major-migration';
import { AutomergeMigration } from './custom/automerge-migration';
import { AutomergeMinorMigration } from './custom/automerge-minor-migration';
import { AutomergePatchMigration } from './custom/automerge-patch-migration';
import { AutomergeTypeMigration } from './custom/automerge-type-migration';
import { AzureGitLabAutomergeMigration } from './custom/azure-gitlab-automerge-migration';
import { BaseBranchMigration } from './custom/base-branch-migration';
import { BinarySourceMigration } from './custom/binary-source-migration';
import { BranchNameMigration } from './custom/branch-name-migration';
import { BranchPrefixMigration } from './custom/branch-prefix-migration';
import { CompatibilityMigration } from './custom/compatibility-migration';
import { ComposerIgnorePlatformReqsMigration } from './custom/composer-ignore-platform-reqs-migration';
import { DryRunMigration } from './custom/dry-run-migration';
import { EnabledManagersMigration } from './custom/enabled-managers-migration';
import { ExtendsMigration } from './custom/extends-migration';
import { GoModTidyMigration } from './custom/go-mod-tidy-migration';
import { HostRulesMigration } from './custom/host-rules-migration';
import { IgnoreNodeModulesMigration } from './custom/ignore-node-modules-migration';
import { IgnoreNpmrcFileMigration } from './custom/ignore-npmrc-file-migration';
import { MatchStringsMigration } from './custom/match-strings-migration';
import { PackageNameMigration } from './custom/package-name-migration';
import { PackagePatternMigration } from './custom/package-pattern-migration';
import { PackagesMigration } from './custom/packages-migration';
import { PathRulesMigration } from './custom/path-rules-migration';
import { PinVersionsMigration } from './custom/pin-versions-migration';
import { PostUpdateOptionsMigration } from './custom/post-update-options-migration';
import { RaiseDeprecationWarningsMigration } from './custom/raise-deprecation-warnings-migration';
import { RebaseConflictedPrs } from './custom/rebase-conflicted-prs-migration';
import { RebaseStalePrsMigration } from './custom/rebase-stale-prs-migration';
import { RenovateForkMigration } from './custom/renovate-fork-migration';
import { RequireConfigMigration } from './custom/require-config-migration';
import { RequiredStatusChecksMigration } from './custom/required-status-checks-migration';
import { ScheduleMigration } from './custom/schedule-migration';
import { SemanticCommitsMigration } from './custom/semantic-commits-migration';
import { SeparateMajorReleasesMigration } from './custom/separate-major-release-migration';
import { SeparateMultipleMajorMigration } from './custom/separate-multiple-major-migration';
import { SuppressNotificationsMigration } from './custom/suppress-notifications-migration';
import { TrustLevelMigration } from './custom/trust-level-migration';
import { UnpublishSafeMigration } from './custom/unpublish-safe-migration';
import { UpgradeInRangeMigration } from './custom/upgrade-in-range-migration';
import { VersionStrategyMigration } from './custom/version-strategy-migration';
import type { Migration, MigrationConstructor } from './types';

export class MigrationsService {
  static readonly removedProperties: ReadonlySet<string> = new Set([
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

  static readonly renamedProperties: ReadonlyMap<string, string> = new Map([
    ['endpoints', 'hostRules'],
    ['excludedPackageNames', 'excludePackageNames'],
    ['exposeEnv', 'exposeAllEnv'],
    ['managerBranchPrefix', 'additionalBranchPrefix'],
    ['multipleMajorPrs', 'separateMultipleMajor'],
    ['separatePatchReleases', 'separateMinorPatch'],
    ['versionScheme', 'versioning'],
    ['lookupNameTemplate', 'packageNameTemplate'],
  ]);

  static readonly customMigrations: ReadonlyArray<MigrationConstructor> = [
    AutomergeMajorMigration,
    AutomergeMigration,
    AutomergeMinorMigration,
    AutomergePatchMigration,
    AutomergeTypeMigration,
    AzureGitLabAutomergeMigration,
    BaseBranchMigration,
    BinarySourceMigration,
    BranchNameMigration,
    BranchPrefixMigration,
    CompatibilityMigration,
    ComposerIgnorePlatformReqsMigration,
    EnabledManagersMigration,
    ExtendsMigration,
    GoModTidyMigration,
    HostRulesMigration,
    IgnoreNodeModulesMigration,
    IgnoreNpmrcFileMigration,
    MatchStringsMigration,
    PackageNameMigration,
    PackagePatternMigration,
    PackagesMigration,
    PathRulesMigration,
    PinVersionsMigration,
    PostUpdateOptionsMigration,
    RaiseDeprecationWarningsMigration,
    RebaseConflictedPrs,
    RebaseStalePrsMigration,
    RenovateForkMigration,
    RequiredStatusChecksMigration,
    ScheduleMigration,
    SemanticCommitsMigration,
    SeparateMajorReleasesMigration,
    SeparateMultipleMajorMigration,
    SuppressNotificationsMigration,
    TrustLevelMigration,
    UnpublishSafeMigration,
    UpgradeInRangeMigration,
    VersionStrategyMigration,
    DryRunMigration,
    RequireConfigMigration,
  ];

  static run(originalConfig: RenovateConfig): RenovateConfig {
    const migratedConfig: RenovateConfig = {};
    const migrations = this.getMigrations(originalConfig, migratedConfig);

    for (const [key, value] of Object.entries(originalConfig)) {
      migratedConfig[key] ??= value;
      const migration = MigrationsService.#getMigration(migrations, key);

      if (migration) {
        migration.run(value, key);

        if (migration.deprecated) {
          delete migratedConfig[key];
        }
      }
    }

    return migratedConfig;
  }

  static isMigrated(
    originalConfig: RenovateConfig,
    migratedConfig: RenovateConfig
  ): boolean {
    return !dequal(originalConfig, migratedConfig);
  }

  protected static getMigrations(
    originalConfig: RenovateConfig,
    migratedConfig: RenovateConfig
  ): ReadonlyArray<Migration> {
    const migrations: Migration[] = [];

    for (const propertyName of MigrationsService.removedProperties) {
      migrations.push(
        new RemovePropertyMigration(
          propertyName,
          originalConfig,
          migratedConfig
        )
      );
    }

    for (const [
      oldPropertyName,
      newPropertyName,
    ] of MigrationsService.renamedProperties.entries()) {
      migrations.push(
        new RenamePropertyMigration(
          oldPropertyName,
          newPropertyName,
          originalConfig,
          migratedConfig
        )
      );
    }

    for (const CustomMigration of this.customMigrations) {
      migrations.push(new CustomMigration(originalConfig, migratedConfig));
    }

    return migrations;
  }

  static #getMigration(
    migrations: ReadonlyArray<Migration>,
    key: string
  ): Migration | undefined {
    return migrations.find((migration) => {
      if (is.regExp(migration.propertyName)) {
        return migration.propertyName.test(key);
      }

      return migration.propertyName === key;
    });
  }
}
