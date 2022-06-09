import type { PackageDependency, PackageFile } from '../types';
import type { AzurePipelines, Container, Repository } from './types';
export declare function extractRepository(repository: Repository): PackageDependency | null;
export declare function extractContainer(container: Container): PackageDependency | null;
export declare function parseAzurePipelines(content: string, filename: string): AzurePipelines | null;
export declare function extractPackageFile(content: string, filename: string): PackageFile | null;
