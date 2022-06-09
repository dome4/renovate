import { BranchStatus, VulnerabilityAlert } from '../../../types';
import type { BranchStatusConfig, CreatePRConfig, EnsureCommentConfig, EnsureCommentRemovalConfig, EnsureIssueConfig, FindPRConfig, Issue, MergePRConfig, PlatformParams, PlatformResult, Pr, RepoParams, RepoResult, UpdatePrConfig } from '../types';
import type { GitlabIssue } from './types';
export declare function initPlatform({ endpoint, token, gitAuthor, }: PlatformParams): Promise<PlatformResult>;
export declare function getRepos(): Promise<string[]>;
export declare function getRawFile(fileName: string, repoName?: string, branchOrTag?: string): Promise<string | null>;
export declare function getJsonFile(fileName: string, repoName?: string, branchOrTag?: string): Promise<any | null>;
export declare function initRepo({ repository, cloneSubmodules, ignorePrAuthor, gitUrl, }: RepoParams): Promise<RepoResult>;
export declare function getRepoForceRebase(): Promise<boolean>;
export declare function getBranchStatus(branchName: string): Promise<BranchStatus>;
export declare function getPrList(): Promise<Pr[]>;
export declare function createPr({ sourceBranch, targetBranch, prTitle, prBody: rawDescription, draftPR, labels, platformOptions, }: CreatePRConfig): Promise<Pr>;
export declare function getPr(iid: number): Promise<Pr>;
export declare function updatePr({ number: iid, prTitle, prBody: description, state, platformOptions, }: UpdatePrConfig): Promise<void>;
export declare function mergePr({ id }: MergePRConfig): Promise<boolean>;
export declare function massageMarkdown(input: string): string;
export declare function findPr({ branchName, prTitle, state, }: FindPRConfig): Promise<Pr | null>;
export declare function getBranchPr(branchName: string): Promise<Pr | null>;
export declare function getBranchStatusCheck(branchName: string, context: string): Promise<BranchStatus | null>;
export declare function setBranchStatus({ branchName, context, description, state: renovateState, url: targetUrl, }: BranchStatusConfig): Promise<void>;
export declare function getIssueList(): Promise<GitlabIssue[]>;
export declare function getIssue(number: number, useCache?: boolean): Promise<Issue | null>;
export declare function findIssue(title: string): Promise<Issue | null>;
export declare function ensureIssue({ title, reuseTitle, body, labels, confidential, }: EnsureIssueConfig): Promise<'updated' | 'created' | null>;
export declare function ensureIssueClosing(title: string): Promise<void>;
export declare function addAssignees(iid: number, assignees: string[]): Promise<void>;
export declare function addReviewers(iid: number, reviewers: string[]): Promise<void>;
export declare function deleteLabel(issueNo: number, label: string): Promise<void>;
export declare function ensureComment({ number, topic, content, }: EnsureCommentConfig): Promise<boolean>;
export declare function ensureCommentRemoval(deleteConfig: EnsureCommentRemovalConfig): Promise<void>;
export declare function getVulnerabilityAlerts(): Promise<VulnerabilityAlert[]>;
export declare function filterUnavailableUsers(users: string[]): Promise<string[]>;
