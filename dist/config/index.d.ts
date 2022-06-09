import type { AllConfig, ManagerConfig, RenovateConfig, RenovateConfigStage } from './types';
import { mergeChildConfig } from './utils';
export { mergeChildConfig };
export declare function getManagerConfig(config: RenovateConfig, manager: string): ManagerConfig;
export declare function filterConfig(inputConfig: AllConfig, targetStage: RenovateConfigStage): AllConfig;
