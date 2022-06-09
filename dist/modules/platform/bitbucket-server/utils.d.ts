import { HostRule } from '../../../types';
import type { HttpOptions, HttpPostOptions } from '../../../util/http/types';
import type { BbsPr, BbsRestPr, BbsRestRepo, BitbucketError } from './types';
export declare const BITBUCKET_INVALID_REVIEWERS_EXCEPTION = "com.atlassian.bitbucket.pull.InvalidPullRequestReviewersException";
export declare function prInfo(pr: BbsRestPr): BbsPr;
export declare function accumulateValues<T = any>(reqUrl: string, method?: string, options?: HttpOptions | HttpPostOptions, limit?: number): Promise<T[]>;
export interface BitbucketCommitStatus {
    failed: number;
    inProgress: number;
    successful: number;
}
export declare type BitbucketBranchState = 'SUCCESSFUL' | 'FAILED' | 'INPROGRESS' | 'STOPPED';
export interface BitbucketStatus {
    key: string;
    state: BitbucketBranchState;
}
export declare function isInvalidReviewersResponse(err: BitbucketError): boolean;
export declare function getInvalidReviewers(err: BitbucketError): string[];
export declare function getRepoGitUrl(repository: string, defaultEndpoint: string, info: BbsRestRepo, opts: HostRule): string;
