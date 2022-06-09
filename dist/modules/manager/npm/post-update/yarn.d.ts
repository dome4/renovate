/// <reference types="node" />
import type { PostUpdateConfig, Upgrade } from '../../types';
import type { NpmManagerData } from '../types';
import type { GenerateLockFileResult } from './types';
export declare function checkYarnrc(lockFileDir: string): Promise<{
    offlineMirror: boolean;
    yarnPath: string | null;
}>;
export declare function getOptimizeCommand(fileName?: string): string;
export declare function isYarnUpdate(upgrade: Upgrade): boolean;
export declare function generateLockFile(lockFileDir: string, env: NodeJS.ProcessEnv, config?: Partial<PostUpdateConfig<NpmManagerData>>, upgrades?: Upgrade[]): Promise<GenerateLockFileResult>;
