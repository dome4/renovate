import type { ReleaseResult } from './types';
export declare function massageGithubUrl(url: string): string;
export declare function normalizeDate(input: any): string | null;
export declare function addMetaData(dep: ReleaseResult, datasource: string, packageName: string): void;
