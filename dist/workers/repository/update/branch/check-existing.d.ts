import { Pr } from '../../../../modules/platform';
import type { BranchConfig } from '../../../types';
export declare function prAlreadyExisted(config: BranchConfig): Promise<Pr | null>;
