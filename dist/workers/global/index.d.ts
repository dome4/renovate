import type { AllConfig, RenovateConfig, RenovateRepository } from '../../config/types';
export declare function getRepositoryConfig(globalConfig: RenovateConfig, repository: RenovateRepository): Promise<RenovateConfig>;
export declare function validatePresets(config: AllConfig): Promise<void>;
export declare function resolveGlobalExtends(globalExtends: string[]): Promise<AllConfig>;
export declare function start(): Promise<number>;
