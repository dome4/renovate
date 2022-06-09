import type { CustomExtractConfig, PackageDependency } from '../types';
export declare function handleAny(content: string, packageFile: string, config: CustomExtractConfig): PackageDependency[];
export declare function handleCombination(content: string, packageFile: string, config: CustomExtractConfig): PackageDependency[];
export declare function handleRecursive(content: string, packageFile: string, config: CustomExtractConfig, index?: number, combinedGroups?: Record<string, string>): PackageDependency[];
