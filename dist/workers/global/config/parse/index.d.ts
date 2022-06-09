/// <reference types="node" />
import type { AllConfig } from '../../../../config/types';
export declare function parseConfigs(env: NodeJS.ProcessEnv, argv: string[]): Promise<AllConfig>;
