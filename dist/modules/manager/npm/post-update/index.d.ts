import type { FileChange } from '../../../../util/git/types';
import type { PostUpdateConfig } from '../../types';
import type { NpmManagerData } from '../types';
import type { AdditionalPackageFiles, DetermineLockFileDirsResult, WriteExistingFilesResult } from './types';
export declare function determineLockFileDirs(config: PostUpdateConfig, packageFiles: AdditionalPackageFiles): DetermineLockFileDirsResult;
export declare function writeExistingFiles(config: PostUpdateConfig, packageFiles: AdditionalPackageFiles): Promise<void>;
export declare function writeUpdatedPackageFiles(config: PostUpdateConfig): Promise<void>;
export declare function updateYarnBinary(lockFileDir: string, updatedArtifacts: FileChange[], existingYarnrcYmlContent: string | undefined): Promise<string | undefined>;
export declare function getAdditionalFiles(config: PostUpdateConfig<NpmManagerData>, packageFiles: AdditionalPackageFiles): Promise<WriteExistingFilesResult>;
