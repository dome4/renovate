import { Release } from '../../../../../modules/datasource';
import type { BranchUpgradeConfig } from '../../../../types';
export declare function getInRangeReleases(config: BranchUpgradeConfig): Promise<Release[] | null>;
