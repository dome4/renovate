import type { RenovateConfig } from '../../config/types';
import { BranchConfig } from '../types';
export declare function readDashboardBody(config: RenovateConfig): Promise<void>;
export declare function ensureDependencyDashboard(config: RenovateConfig, allBranches: BranchConfig[]): Promise<void>;
