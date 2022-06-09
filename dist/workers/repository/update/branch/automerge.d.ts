import type { RenovateConfig } from '../../../../config/types';
export declare type AutomergeResult = 'automerged' | 'automerge aborted - PR exists' | 'branch status error' | 'failed' | 'no automerge' | 'stale' | 'off schedule' | 'not ready';
export declare function tryBranchAutomerge(config: RenovateConfig): Promise<AutomergeResult>;
