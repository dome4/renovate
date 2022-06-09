import type { RenovateConfig } from '../../../../config/types';
import { PlatformPrOptions, Pr } from '../../../../modules/platform';
import type { BranchConfig, PrBlockedBy } from '../../../types';
export declare function getPlatformPrOptions(config: RenovateConfig & PlatformPrOptions): PlatformPrOptions;
export declare type ResultWithPr = {
    type: 'with-pr';
    pr: Pr;
};
export declare type ResultWithoutPr = {
    type: 'without-pr';
    prBlockedBy: PrBlockedBy;
};
export declare type EnsurePrResult = ResultWithPr | ResultWithoutPr;
export declare function ensurePr(prConfig: BranchConfig): Promise<EnsurePrResult>;
