import type { Release } from '../../../../modules/datasource';
import type { VersioningApi } from '../../../../modules/versioning';
import type { LookupUpdateConfig, UpdateResult } from './types';
export interface InternalChecksResult {
    release: Release;
    pendingChecks: boolean;
    pendingReleases?: Release[];
}
export declare function filterInternalChecks(config: Partial<LookupUpdateConfig & UpdateResult>, versioning: VersioningApi, bucket: string, sortedReleases: Release[]): Promise<InternalChecksResult>;
