import type { Release } from '../../../../modules/datasource/types';
import type { LookupUpdate } from '../../../../modules/manager/types';
import type { VersioningApi } from '../../../../modules/versioning';
import type { RollbackConfig } from './types';
export declare function getRollbackUpdate(config: RollbackConfig, versions: Release[], version: VersioningApi): LookupUpdate | null;
