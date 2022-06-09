import { BranchStatus, PrState } from '../../../types';
import { GiteaHttpOptions } from '../../../util/http/gitea';
import type { PrReviewersParams } from './types';
export declare type PRState = PrState.Open | PrState.Closed | PrState.All;
export declare type IssueState = 'open' | 'closed' | 'all';
export declare type CommitStatusType = 'pending' | 'success' | 'error' | 'failure' | 'warning' | 'unknown';
export declare type PRMergeMethod = 'merge' | 'rebase' | 'rebase-merge' | 'squash';
export interface PR {
    number: number;
    state: PRState;
    title: string;
    body: string;
    mergeable: boolean;
    created_at: string;
    closed_at: string;
    diff_url: string;
    base?: {
        ref: string;
    };
    head?: {
        label: string;
        sha: string;
        repo?: Repo;
    };
    assignee?: {
        login?: string;
    };
    assignees?: any[];
    user?: {
        username?: string;
    };
}
export interface Issue {
    number: number;
    state: IssueState;
    title: string;
    body: string;
    assignees: User[];
    labels: Label[];
}
export interface User {
    id: number;
    email: string;
    full_name?: string;
    username: string;
}
export interface Repo {
    allow_merge_commits: boolean;
    allow_rebase: boolean;
    allow_rebase_explicit: boolean;
    allow_squash_merge: boolean;
    archived: boolean;
    clone_url?: string;
    ssh_url?: string;
    default_branch: string;
    empty: boolean;
    fork: boolean;
    full_name: string;
    mirror: boolean;
    owner: User;
    permissions: RepoPermission;
}
export interface RepoPermission {
    admin: boolean;
    pull: boolean;
    push: boolean;
}
export interface RepoSearchResults {
    ok: boolean;
    data: Repo[];
}
export interface RepoContents {
    path: string;
    content?: string;
    contentString?: string;
}
export interface Comment {
    id: number;
    body: string;
}
export interface Label {
    id: number;
    name: string;
    description: string;
    color: string;
}
export interface Branch {
    name: string;
    commit: Commit;
}
export interface Commit {
    id: string;
    author: CommitUser;
}
export interface CommitUser {
    name: string;
    email: string;
    username: string;
}
export interface CommitStatus {
    id: number;
    status: CommitStatusType;
    context: string;
    description: string;
    target_url: string;
    created_at: string;
}
export interface CombinedCommitStatus {
    worstStatus: CommitStatusType;
    statuses: CommitStatus[];
}
export declare type RepoSearchParams = {
    uid?: number;
    archived?: boolean;
};
export declare type IssueCreateParams = Partial<IssueUpdateLabelsParams> & IssueUpdateParams;
export declare type IssueUpdateParams = {
    title?: string;
    body?: string;
    state?: IssueState;
    assignees?: string[];
};
export declare type IssueUpdateLabelsParams = {
    labels?: number[];
};
export declare type IssueSearchParams = {
    state?: IssueState;
};
export declare type PRCreateParams = {
    base?: string;
    head?: string;
} & PRUpdateParams;
export declare type PRUpdateParams = {
    title?: string;
    body?: string;
    assignees?: string[];
    labels?: number[];
    state?: PRState;
};
export declare type PRSearchParams = {
    state?: PRState;
    labels?: number[];
};
export declare type PRMergeParams = {
    Do: PRMergeMethod;
};
export declare type CommentCreateParams = CommentUpdateParams;
export declare type CommentUpdateParams = {
    body: string;
};
export declare type CommitStatusCreateParams = {
    context?: string;
    description?: string;
    state?: CommitStatusType;
    target_url?: string;
};
export declare function getCurrentUser(options?: GiteaHttpOptions): Promise<User>;
export declare function getVersion(options?: GiteaHttpOptions): Promise<string>;
export declare function searchRepos(params: RepoSearchParams, options?: GiteaHttpOptions): Promise<Repo[]>;
export declare function getRepo(repoPath: string, options?: GiteaHttpOptions): Promise<Repo>;
export declare function getRepoContents(repoPath: string, filePath: string, ref?: string | null, options?: GiteaHttpOptions): Promise<RepoContents>;
export declare function createPR(repoPath: string, params: PRCreateParams, options?: GiteaHttpOptions): Promise<PR>;
export declare function updatePR(repoPath: string, idx: number, params: PRUpdateParams, options?: GiteaHttpOptions): Promise<PR>;
export declare function closePR(repoPath: string, idx: number, options?: GiteaHttpOptions): Promise<void>;
export declare function mergePR(repoPath: string, idx: number, method: PRMergeMethod, options?: GiteaHttpOptions): Promise<void>;
export declare function getPR(repoPath: string, idx: number, options?: GiteaHttpOptions): Promise<PR>;
export declare function requestPrReviewers(repoPath: string, idx: number, params: PrReviewersParams, options?: GiteaHttpOptions): Promise<void>;
export declare function searchPRs(repoPath: string, params: PRSearchParams, options?: GiteaHttpOptions): Promise<PR[]>;
export declare function createIssue(repoPath: string, params: IssueCreateParams, options?: GiteaHttpOptions): Promise<Issue>;
export declare function updateIssue(repoPath: string, idx: number, params: IssueUpdateParams, options?: GiteaHttpOptions): Promise<Issue>;
export declare function updateIssueLabels(repoPath: string, idx: number, params: IssueUpdateLabelsParams, options?: GiteaHttpOptions): Promise<Label[]>;
export declare function closeIssue(repoPath: string, idx: number, options?: GiteaHttpOptions): Promise<void>;
export declare function searchIssues(repoPath: string, params: IssueSearchParams, options?: GiteaHttpOptions): Promise<Issue[]>;
export declare function getIssue(repoPath: string, idx: number, options?: GiteaHttpOptions): Promise<Issue>;
export declare function getRepoLabels(repoPath: string, options?: GiteaHttpOptions): Promise<Label[]>;
export declare function getOrgLabels(orgName: string, options?: GiteaHttpOptions): Promise<Label[]>;
export declare function unassignLabel(repoPath: string, issue: number, label: number, options?: GiteaHttpOptions): Promise<void>;
export declare function createComment(repoPath: string, issue: number, body: string, options?: GiteaHttpOptions): Promise<Comment>;
export declare function updateComment(repoPath: string, idx: number, body: string, options?: GiteaHttpOptions): Promise<Comment>;
export declare function deleteComment(repoPath: string, idx: number, options?: GiteaHttpOptions): Promise<void>;
export declare function getComments(repoPath: string, issue: number, options?: GiteaHttpOptions): Promise<Comment[]>;
export declare function createCommitStatus(repoPath: string, branchCommit: string, params: CommitStatusCreateParams, options?: GiteaHttpOptions): Promise<CommitStatus>;
export declare const giteaToRenovateStatusMapping: Record<CommitStatusType, BranchStatus | null>;
export declare const renovateToGiteaStatusMapping: Record<BranchStatus, CommitStatusType>;
export declare function getCombinedCommitStatus(repoPath: string, branchName: string, options?: GiteaHttpOptions): Promise<CombinedCommitStatus>;
export declare function getBranch(repoPath: string, branchName: string, options?: GiteaHttpOptions): Promise<Branch>;
