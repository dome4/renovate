import type { PackageFile } from '../types';
import type { UrlPathParsedResult } from './types';
export declare function parseUrlPath(urlStr: string | null | undefined): UrlPathParsedResult | null;
export declare function extractPackageFile(content: string): PackageFile | null;
