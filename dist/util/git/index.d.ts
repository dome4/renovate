import type { RenovateConfig } from '../../config/types';
import type { GitProtocol } from '../../types/git';
import type { CommitFilesConfig, CommitResult, CommitSha, StatusResult, StorageConfig, TreeItem } from './types';
export { setNoVerify } from './config';
export { setPrivateKey } from './private-key';
export declare function gitRetry<T>(gitFunc: () => Promise<T>): Promise<T>;
export declare const GIT_MINIMUM_VERSION = "2.33.0";
export declare function validateGitVersion(): Promise<boolean>;
export declare function initRepo(args: StorageConfig): Promise<void>;
export declare function setGitAuthor(gitAuthor: string | undefined): void;
export declare function writeGitAuthor(): Promise<void>;
export declare function setUserRepoConfig({ gitIgnoredAuthors, gitAuthor, }: RenovateConfig): void;
export declare function getSubmodules(): Promise<string[]>;
export declare function syncGit(): Promise<void>;
export declare function getRepoStatus(): Promise<StatusResult>;
export declare function branchExists(branchName: string): boolean;
export declare function getBranchCommit(branchName: string): CommitSha | null;
export declare function getBranchParentSha(branchName: string): Promise<CommitSha | null>;
export declare function getCommitMessages(): Promise<string[]>;
export declare function checkoutBranch(branchName: string): Promise<CommitSha>;
export declare function getFileList(): Promise<string[]>;
export declare function getBranchList(): string[];
export declare function isBranchStale(branchName: string): Promise<boolean>;
export declare function isBranchModified(branchName: string): Promise<boolean>;
export declare function isBranchConflicted(baseBranch: string, branch: string): Promise<boolean>;
export declare function deleteBranch(branchName: string): Promise<void>;
export declare function mergeBranch(branchName: string): Promise<void>;
export declare function getBranchLastCommitTime(branchName: string): Promise<Date>;
export declare function getBranchFiles(branchName: string): Promise<string[] | null>;
export declare function getFile(filePath: string, branchName?: string): Promise<string | null>;
export declare function hasDiff(branchName: string): Promise<boolean>;
/**
 *
 * Prepare local branch with commit
 *
 * 0. Hard reset
 * 1. Creates local branch with `origin/` prefix
 * 2. Perform `git add` (respecting mode) and `git remove` for each file
 * 3. Perform commit
 * 4. Check whether resulting commit is empty or not (due to .gitignore)
 * 5. If not empty, return commit info for further processing
 *
 */
export declare function prepareCommit({ branchName, files, message, force, }: CommitFilesConfig): Promise<CommitResult | null>;
export declare function pushCommit({ branchName, files, }: CommitFilesConfig): Promise<boolean>;
export declare function fetchCommit({ branchName, files, }: CommitFilesConfig): Promise<CommitSha | null>;
export declare function commitFiles(commitConfig: CommitFilesConfig): Promise<CommitSha | null>;
export declare function getUrl({ protocol, auth, hostname, host, repository, }: {
    protocol?: GitProtocol;
    auth?: string;
    hostname?: string;
    host?: string;
    repository: string;
}): string;
/**
 *
 * Non-branch refs allow us to store git objects without triggering CI pipelines.
 * It's useful for API-based branch rebasing.
 *
 * @see https://stackoverflow.com/questions/63866947/pushing-git-non-branch-references-to-a-remote/63868286
 *
 */
export declare function pushCommitToRenovateRef(commitSha: string, refName: string, section?: string): Promise<void>;
/**
 *
 * Removes all remote "refs/renovate/*" refs in two steps:
 *
 * Step 1: list refs
 *
 *   $ git ls-remote origin "refs/renovate/*"
 *
 *   > cca38e9ea6d10946bdb2d0ca5a52c205783897aa        refs/renovate/foo
 *   > 29ac154936c880068994e17eb7f12da7fdca70e5        refs/renovate/bar
 *   > 3fafaddc339894b6d4f97595940fd91af71d0355        refs/renovate/baz
 *   > ...
 *
 * Step 2:
 *
 *   $ git push --delete origin refs/renovate/foo refs/renovate/bar refs/renovate/baz
 *
 */
export declare function clearRenovateRefs(): Promise<void>;
/**
 *
 * Obtain top-level items of commit tree.
 * We don't need subtree items, so here are 2 steps only.
 *
 * Step 1: commit SHA -> tree SHA
 *
 *   $ git cat-file -p <commit-sha>
 *
 *   > tree <tree-sha>
 *   > parent 59b8b0e79319b7dc38f7a29d618628f3b44c2fd7
 *   > ...
 *
 * Step 2: tree SHA -> tree items (top-level)
 *
 *   $ git cat-file -p <tree-sha>
 *
 *   > 040000 tree 389400684d1f004960addc752be13097fe85d776    src
 *   > ...
 *   > 100644 blob 7d2edde437ad4e7bceb70dbfe70e93350d99c98b    package.json
 *
 */
export declare function listCommitTree(commitSha: string): Promise<TreeItem[]>;
