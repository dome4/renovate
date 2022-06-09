import { GitCommit, GitPullRequestMergeStrategy, GitRef } from 'azure-devops-node-api/interfaces/GitInterfaces.js';
export declare function getRefs(repoId: string, branchName?: string): Promise<GitRef[]>;
export interface AzureBranchObj {
    name: string;
    oldObjectId: string;
}
export declare function getAzureBranchObj(repoId: string, branchName: string, from?: string): Promise<AzureBranchObj>;
export declare function getFile(repoId: string, filePath: string, branchName: string): Promise<string | null>;
export declare function getCommitDetails(commit: string, repoId: string): Promise<GitCommit>;
export declare function getMergeMethod(repoId: string, project: string, branchRef?: string | null, defaultBranch?: string): Promise<GitPullRequestMergeStrategy>;
