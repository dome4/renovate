import { GenericVersion, GenericVersioningApi } from '../generic';
import type { VersioningApiConstructor } from '../types';
export declare const id = "regex";
export declare const displayName = "Regular Expression";
export declare const urls: any[];
export declare const supportsRanges = false;
export interface RegExpVersion extends GenericVersion {
    /**
     * compatibility, if present, are treated as a compatibility layer: we will
     * never try to update to a version with a different compatibility.
     */
    compatibility: string;
}
export declare class RegExpVersioningApi extends GenericVersioningApi<RegExpVersion> {
    private _config;
    constructor(_new_config: string | undefined);
    protected _parse(version: string): RegExpVersion | null;
    isCompatible(version: string, current: string): boolean;
    isLessThanRange(version: string, range: string): boolean;
    getSatisfyingVersion(versions: string[], range: string): string | null;
    minSatisfyingVersion(versions: string[], range: string): string | null;
    matches(version: string, range: string): boolean;
}
export declare const api: VersioningApiConstructor;
export default api;
