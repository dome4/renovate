import type { RenovateConfig } from '../../config/types';
export declare function globalInitialize(config_: RenovateConfig): Promise<RenovateConfig>;
export declare function globalFinalize(config: RenovateConfig): Promise<void>;
