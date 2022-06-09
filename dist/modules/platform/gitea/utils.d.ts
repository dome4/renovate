import type { GitUrlOption } from '../types';
import type { Repo } from './gitea-helper';
export declare function smartLinks(body: string): string;
export declare function trimTrailingApiPath(url: string): string;
export declare function getRepoUrl(repo: Repo, gitUrl: GitUrlOption | undefined, endpoint: string): string;
