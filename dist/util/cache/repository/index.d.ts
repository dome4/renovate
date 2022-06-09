import type { RepoCache, RepoCacheData } from './types';
export declare function resetCache(): void;
export declare function setCache(cache: RepoCache): void;
export declare function getCache(): RepoCacheData;
export declare function saveCache(): Promise<void>;
