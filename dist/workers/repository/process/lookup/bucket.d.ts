import type { VersioningApi } from '../../../../modules/versioning/types';
export interface BucketConfig {
    separateMajorMinor?: boolean;
    separateMultipleMajor?: boolean;
    separateMinorPatch?: boolean;
}
export declare function getBucket(config: BucketConfig, currentVersion: string, newVersion: string, versioning: VersioningApi): string | null;
