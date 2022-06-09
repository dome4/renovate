import type { UpdateArtifact } from '../types';
export declare const delimiters: string[];
export declare function extractRubyVersion(txt: string): string | null;
export declare function getRubyConstraint(updateArtifact: UpdateArtifact): Promise<string | null>;
export declare function getBundlerConstraint(updateArtifact: Pick<UpdateArtifact, 'config'>, existingLockFileContent: string): string | null;
