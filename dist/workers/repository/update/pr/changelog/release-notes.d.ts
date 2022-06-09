import type { BranchUpgradeConfig } from '../../../../types';
import type { ChangeLogFile, ChangeLogNotes, ChangeLogProject, ChangeLogRelease, ChangeLogResult } from './types';
export declare function getReleaseList(project: ChangeLogProject): Promise<ChangeLogNotes[]>;
export declare function getCachedReleaseList(project: ChangeLogProject): Promise<ChangeLogNotes[]>;
export declare function massageBody(input: string | undefined | null, baseUrl: string): string;
export declare function getReleaseNotes(project: ChangeLogProject, release: ChangeLogRelease, config: BranchUpgradeConfig): Promise<ChangeLogNotes | null>;
export declare function getReleaseNotesMdFileInner(project: ChangeLogProject): Promise<ChangeLogFile> | null;
export declare function getReleaseNotesMdFile(project: ChangeLogProject): Promise<ChangeLogFile | null>;
export declare function getReleaseNotesMd(project: ChangeLogProject, release: ChangeLogRelease): Promise<ChangeLogNotes | null>;
/**
 * Determine how long to cache release notes based on when the version was released.
 *
 * It's not uncommon for release notes to be updated shortly after the release itself,
 * so only cache for about an hour when the release is less than a week old. Otherwise,
 * cache for days.
 */
export declare function releaseNotesCacheMinutes(releaseDate?: string | Date): number;
export declare function addReleaseNotes(input: ChangeLogResult, config: BranchUpgradeConfig): Promise<ChangeLogResult>;
