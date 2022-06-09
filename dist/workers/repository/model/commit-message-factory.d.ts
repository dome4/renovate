import type { RenovateSharedConfig } from '../../../config/types';
import type { CommitMessage } from './commit-message';
declare type CommitMessageConfig = Pick<RenovateSharedConfig, 'commitMessagePrefix' | 'semanticCommits' | 'semanticCommitScope' | 'semanticCommitType'>;
export declare class CommitMessageFactory {
    private readonly _config;
    constructor(config: CommitMessageConfig);
    create(): CommitMessage;
    private createSemanticCommitMessage;
    private createCustomCommitMessage;
    private get areSemanticCommitsEnabled();
}
export {};
