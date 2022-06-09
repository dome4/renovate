import { GitPullRequest, GitRepository, GitStatusContext } from 'azure-devops-node-api/interfaces/GitInterfaces.js';
import { HostRule } from '../../../types';
import type { GitOptions } from '../../../types/git';
import type { AzurePr } from './types';
export declare function getNewBranchName(branchName?: string): string | undefined;
export declare function getGitStatusContextCombinedName(context: GitStatusContext | null | undefined): string | undefined;
export declare function getGitStatusContextFromCombinedName(context: string | undefined | null): GitStatusContext | undefined;
export declare function getBranchNameWithoutRefsheadsPrefix(branchPath: string | undefined): string | undefined;
export declare function getBranchNameWithoutRefsPrefix(branchPath?: string): string | undefined;
export declare function getRenovatePRFormat(azurePr: GitPullRequest): AzurePr;
export declare function getStorageExtraCloneOpts(config: HostRule): GitOptions;
export declare function max4000Chars(str: string): string;
export declare function getProjectAndRepo(str: string): {
    project: string;
    repo: string;
};
export declare function getRepoByName(name: string, repos: (GitRepository | null | undefined)[] | undefined | null): GitRepository | null;
