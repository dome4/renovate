import type { RenovateConfig } from '../../../config/types';
import type { BranchConfig } from '../../types';
import { ExtractResult } from './extract-update';
import type { WriteUpdateResult } from './write';
export declare function extractDependencies(config: RenovateConfig): Promise<ExtractResult>;
export declare function updateRepo(config: RenovateConfig, branches: BranchConfig[]): Promise<WriteUpdateResult | undefined>;
