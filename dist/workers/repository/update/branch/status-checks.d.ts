import type { RenovateConfig } from '../../../../config/types';
import { BranchStatus } from '../../../../types';
import { MergeConfidence } from '../../../../util/merge-confidence';
export declare function resolveBranchStatus(branchName: string, ignoreTests?: boolean): Promise<BranchStatus>;
export declare type StabilityConfig = RenovateConfig & {
    stabilityStatus?: BranchStatus;
    branchName: string;
};
export declare function setStability(config: StabilityConfig): Promise<void>;
export declare type ConfidenceConfig = RenovateConfig & {
    confidenceStatus?: BranchStatus;
    minimumConfidence?: MergeConfidence;
};
export declare function setConfidence(config: ConfidenceConfig): Promise<void>;
