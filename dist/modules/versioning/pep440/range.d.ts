import type { NewValueConfig } from '../types';
export declare function getNewValue({ currentValue, rangeStrategy, currentVersion, newVersion, }: NewValueConfig): string | null;
export declare function isLessThanRange(input: string, range: string): boolean;
export declare function checkRangeAndRemoveUnnecessaryRangeLimit(rangeInput: string, newVersion: string): string;
