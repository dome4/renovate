import type { WorkerExtractConfig } from '../../../config/types';
import type { PackageFile } from '../../../modules/manager/types';
export declare function getManagerPackageFiles(config: WorkerExtractConfig): Promise<PackageFile[]>;
