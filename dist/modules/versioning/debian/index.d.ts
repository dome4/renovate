import type { RangeStrategy } from '../../../types';
import { GenericVersioningApi } from '../generic';
import type { GenericVersion } from '../generic';
import type { NewValueConfig, VersioningApi } from '../types';
export declare const id = "debian";
export declare const displayName = "Debian";
export declare const urls: string[];
export declare const supportsRanges = true;
export declare const supportedRangeStrategies: RangeStrategy[];
export declare class DebianVersioningApi extends GenericVersioningApi {
    private readonly _distroInfo;
    private readonly _rollingReleases;
    constructor();
    isValid(version: string): boolean;
    isStable(version: string): boolean;
    getNewValue({ currentValue, rangeStrategy, currentVersion, newVersion, }: NewValueConfig): string;
    protected _parse(version: string): GenericVersion | null;
}
export declare const api: VersioningApi;
export default api;
