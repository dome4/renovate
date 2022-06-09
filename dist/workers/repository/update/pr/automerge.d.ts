import { Pr } from '../../../../modules/platform';
import type { BranchConfig } from '../../../types';
export declare enum PrAutomergeBlockReason {
    BranchModified = "BranchModified",
    BranchNotGreen = "BranchNotGreen",
    Conflicted = "Conflicted",
    DryRun = "DryRun",
    PlatformNotReady = "PlatformNotReady",
    PlatformRejection = "PlatformRejection",
    OffSchedule = "off schedule"
}
export declare type AutomergePrResult = {
    automerged: boolean;
    branchRemoved?: boolean;
    prAutomergeBlockReason?: PrAutomergeBlockReason;
};
export declare function checkAutoMerge(pr: Pr, config: BranchConfig): Promise<AutomergePrResult>;
