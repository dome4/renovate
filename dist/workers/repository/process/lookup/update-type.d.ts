import type { UpdateType } from '../../../../config/types';
import type * as allVersioning from '../../../../modules/versioning';
export interface UpdateTypeConfig {
    separateMajorMinor?: boolean;
    separateMultipleMajor?: boolean;
    separateMinorPatch?: boolean;
}
export declare function getUpdateType(config: UpdateTypeConfig, versioning: allVersioning.VersioningApi, currentVersion: string, newVersion: string): UpdateType;
