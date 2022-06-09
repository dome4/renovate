import type { BranchUpgradeConfig } from '../../../types';
export declare function confirmIfDepUpdated(upgrade: BranchUpgradeConfig, newContent: string): Promise<boolean>;
export declare function checkBranchDepsMatchBaseDeps(upgrade: BranchUpgradeConfig, branchContent: string): Promise<boolean>;
export declare function doAutoReplace(upgrade: BranchUpgradeConfig, existingContent: string, reuseExistingBranch: boolean): Promise<string | null>;
