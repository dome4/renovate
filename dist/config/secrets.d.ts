import type { AllConfig, RenovateConfig } from './types';
export declare function validateConfigSecrets(config: AllConfig): void;
export declare function applySecretsToConfig(config: RenovateConfig, secrets?: Record<string, string>, deleteSecrets?: boolean): RenovateConfig;
