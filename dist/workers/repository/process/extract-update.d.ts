import type { RenovateConfig } from '../../../config/types';
import type { PackageFile } from '../../../modules/manager/types';
import type { BranchConfig } from '../../types';
import { WriteUpdateResult } from './write';
export declare type ExtractResult = {
    branches: BranchConfig[];
    branchList: string[];
    packageFiles: Record<string, PackageFile[]>;
};
export declare function extract(config: RenovateConfig): Promise<Record<string, PackageFile[]>>;
export declare function lookup(config: RenovateConfig, packageFiles: Record<string, PackageFile[]>): Promise<ExtractResult>;
export declare function update(config: RenovateConfig, branches: BranchConfig[]): Promise<WriteUpdateResult | undefined>;
