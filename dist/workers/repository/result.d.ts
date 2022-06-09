import type { RenovateConfig } from '../../config/types';
export declare type ProcessStatus = 'disabled' | 'onboarded' | 'activated' | 'onboarding' | 'unknown';
export interface ProcessResult {
    res: string;
    status: ProcessStatus;
    enabled: boolean | undefined;
    onboarded: boolean | undefined;
}
export declare function processResult(config: RenovateConfig, res: string): ProcessResult;
