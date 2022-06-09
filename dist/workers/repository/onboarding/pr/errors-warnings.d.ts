import type { RenovateConfig } from '../../../../config/types';
import type { PackageFile } from '../../../../modules/manager/types';
export declare function getWarnings(config: RenovateConfig): string;
export declare function getErrors(config: RenovateConfig): string;
export declare function getDepWarnings(packageFiles: Record<string, PackageFile[]>): string;
