import type { UpdateArtifactsResult } from '../../types';
import type { ProviderLock, ProviderLockUpdate } from './types';
export declare function findLockFile(packageFilePath: string): string;
export declare function readLockFile(lockFilePath: string): Promise<string>;
export declare function extractLocks(lockFileContent: string): ProviderLock[] | null;
export declare function isPinnedVersion(value: string | undefined): boolean;
export declare function writeLockUpdates(updates: ProviderLockUpdate[], lockFilePath: string, oldLockFileContent: string): UpdateArtifactsResult;
