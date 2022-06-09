import type { PackageDependency, PackageFile } from '../types';
import type { ExtractContext, ExtractedVariables } from './types';
export declare function trimAtKey(str: string, kwName: string): string | null;
export declare function expandDepName(name: string): string;
export declare function extractFromVectors(str: string, ctx?: ExtractContext, vars?: ExtractedVariables): PackageDependency[];
export declare function extractVariables(content: string): ExtractedVariables;
export declare function extractPackageFile(content: string): PackageFile;
