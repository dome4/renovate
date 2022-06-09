import type { ArtifactError } from '../../../../modules/manager/types';
import type { FileChange } from '../../../../util/git/types';
import type { BranchConfig, BranchUpgradeConfig } from '../../../types';
export declare type PostUpgradeCommandsExecutionResult = {
    updatedArtifacts: FileChange[];
    artifactErrors: ArtifactError[];
};
export declare function postUpgradeCommandsExecutor(filteredUpgradeCommands: BranchUpgradeConfig[], config: BranchConfig): Promise<PostUpgradeCommandsExecutionResult>;
export default function executePostUpgradeCommands(config: BranchConfig): Promise<PostUpgradeCommandsExecutionResult | null>;
