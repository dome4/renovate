import type { RangeStrategy } from '../../../types/versioning';
import type { VersioningApi } from '../types';
import { isValid } from './compare';
export declare const id = "maven";
export declare const displayName = "Maven";
export declare const urls: string[];
export declare const supportsRanges = true;
export declare const supportedRangeStrategies: RangeStrategy[];
export { isValid };
export declare const api: VersioningApi;
export default api;
