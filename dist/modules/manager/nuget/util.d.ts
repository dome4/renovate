import type { Registry } from './types';
export declare function getRandomString(): string;
export declare function getDefaultRegistries(): Registry[];
export declare function getConfiguredRegistries(packageFile: string): Promise<Registry[] | undefined>;
