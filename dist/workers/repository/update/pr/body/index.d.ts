import type { BranchConfig } from '../../../../types';
interface PrBodyConfig {
    appendExtra?: string | null | undefined;
    rebasingNotice?: string;
}
export declare function getPrBody(branchConfig: BranchConfig, prBodyConfig?: PrBodyConfig): Promise<string>;
export {};
