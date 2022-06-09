import type { ToolConstraint } from '../../../util/exec/types';
import { id as composerVersioningId } from '../../versioning/composer';
import type { UpdateArtifactsConfig } from '../types';
import type { ComposerConfig, ComposerLock } from './types';
export { composerVersioningId };
export declare function getComposerArguments(config: UpdateArtifactsConfig, toolConstraint: ToolConstraint): string;
export declare function getPhpConstraint(constraints: Record<string, string>): string | null;
export declare function requireComposerDependencyInstallation(lock: ComposerLock): boolean;
export declare function extractContraints(composerJson: ComposerConfig, lockParsed: ComposerLock): Record<string, string>;
