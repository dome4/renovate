import type { ExtractConfig, PackageFile } from '../types';
import type { ExtractionResult } from './types';
export declare function extractPackageFile(content: string, fileName: string): ExtractionResult | null;
export declare function extractAllPackageFiles(config: ExtractConfig, packageFiles: string[]): Promise<PackageFile[] | null>;
