import type { PackageDependency, PackageFile } from '../types';
export declare function extractVariables(image: string): Record<string, string>;
export declare function splitImageParts(currentFrom: string): PackageDependency;
export declare function getDep(currentFrom: string | null | undefined, specifyReplaceString?: boolean): PackageDependency;
export declare function extractPackageFile(content: string): PackageFile | null;
