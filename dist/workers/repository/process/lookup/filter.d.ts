import type { Release } from '../../../../modules/datasource/types';
import type { VersioningApi } from '../../../../modules/versioning';
import type { FilterConfig } from './types';
export declare function filterVersions(config: FilterConfig, currentVersion: string, latestVersion: string, releases: Release[], versioning: VersioningApi): Release[];
