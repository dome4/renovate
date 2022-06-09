import type { ChangeLogFile, ChangeLogNotes } from '../types';
export declare const id = "github-changelog";
export declare function getTags(endpoint: string, repository: string): Promise<string[]>;
export declare function getReleaseNotesMd(repository: string, apiBaseUrl: string, sourceDirectory: string): Promise<ChangeLogFile | null>;
export declare function getReleaseList(apiBaseUrl: string, repository: string): Promise<ChangeLogNotes[]>;
