import type { RenovateConfig, RepoGlobalConfig } from './types';
export declare class GlobalConfig {
    private static readonly OPTIONS;
    private static config;
    static get(): RepoGlobalConfig;
    static get<Key extends keyof RepoGlobalConfig>(key?: Key): RepoGlobalConfig[Key];
    static set(config: RenovateConfig | RepoGlobalConfig): RenovateConfig;
    static reset(): void;
}
