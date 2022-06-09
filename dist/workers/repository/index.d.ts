import type { RenovateConfig } from '../../config/types';
import { ProcessResult } from './result';
export declare function renovateRepository(repoConfig: RenovateConfig, canRetry?: boolean): Promise<ProcessResult>;
