import type { PackageDependency } from '../types';
import type { ExtractionResult, TerraformManagerData } from './types';
export declare const githubRefMatchRegex: RegExp;
export declare const gitTagsRefMatchRegex: RegExp;
export declare function extractTerragruntModule(startingLine: number, lines: string[]): ExtractionResult;
export declare function analyseTerragruntModule(dep: PackageDependency<TerraformManagerData>): void;
