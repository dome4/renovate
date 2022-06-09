import type { CustomExtractConfig, PackageDependency } from '../types';
import type { ExtractionTemplate } from './types';
export declare const validMatchFields: readonly ["depName", "packageName", "currentValue", "currentDigest", "datasource", "versioning", "extractVersion", "registryUrl", "depType"];
export declare function createDependency(extractionTemplate: ExtractionTemplate, config: CustomExtractConfig, dep?: PackageDependency): PackageDependency | null;
export declare function regexMatchAll(regex: RegExp, content: string): RegExpMatchArray[];
export declare function mergeGroups(mergedGroup: Record<string, string>, secondGroup: Record<string, string>): Record<string, string>;
export declare function mergeExtractionTemplate(base: ExtractionTemplate, addition: ExtractionTemplate): ExtractionTemplate;
