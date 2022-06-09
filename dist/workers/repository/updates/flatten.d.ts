import type { RenovateConfig } from '../../../config/types';
import type { BranchUpgradeConfig } from '../../types';
export declare function applyUpdateConfig(input: BranchUpgradeConfig): any;
export declare function flattenUpdates(config: RenovateConfig, packageFiles: Record<string, any[]>): Promise<RenovateConfig[]>;
