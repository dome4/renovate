import type { Merge } from 'type-fest';
import type { RenovateConfig } from '../../../config/types';
import type { BranchConfig } from '../../types';
export declare type BranchifiedConfig = Merge<RenovateConfig, {
    branches: BranchConfig[];
    branchList: string[];
}>;
export declare function branchifyUpgrades(config: RenovateConfig, packageFiles: Record<string, any[]>): Promise<BranchifiedConfig>;
