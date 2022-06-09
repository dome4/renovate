import type { LockFile } from './types';
export declare function getYarnLock(filePath: string): Promise<LockFile>;
export declare function getZeroInstallPaths(yarnrcYml: string): string[];
export declare function isZeroInstall(yarnrcYmlPath: string): Promise<boolean>;
