import type { UpdateArtifact, UpdateArtifactsResult } from '../../types';
export declare function updateArtifacts({ packageFileName, updatedDeps, config, }: UpdateArtifact): Promise<UpdateArtifactsResult[] | null>;
