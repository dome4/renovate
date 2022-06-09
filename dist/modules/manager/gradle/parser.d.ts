import type { PackageDependency } from '../types';
import type { GradleManagerData, PackageVariables, ParseGradleResult } from './types';
export declare function parseGradle(input: string, initVars?: PackageVariables, packageFile?: string): ParseGradleResult;
export declare function parseProps(input: string, packageFile?: string): {
    vars: PackageVariables;
    deps: PackageDependency<GradleManagerData>[];
};
