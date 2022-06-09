import type { ExtractConfig, PackageDependency, PackageFile } from '../types';
import type { Image, Job, Services } from './types';
export declare function extractFromImage(image: Image | undefined): PackageDependency | null;
export declare function extractFromServices(services: Services | undefined): PackageDependency[];
export declare function extractFromJob(job: Job | undefined): PackageDependency[];
export declare function extractPackageFile(content: string): PackageFile | null;
export declare function extractAllPackageFiles(_config: ExtractConfig, packageFiles: string[]): Promise<PackageFile[] | null>;
