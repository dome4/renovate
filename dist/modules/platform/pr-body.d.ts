import type { PrBodyStruct } from './types';
export declare function hashBody(body: string | undefined): string;
export declare function isRebaseRequested(body: string | undefined): boolean;
export declare function getPrBodyStruct(input: string | undefined | null): PrBodyStruct;
