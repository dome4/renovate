import { ReleaseType } from 'semver';
import type { BumpPackageVersionResult } from '../types';
export declare function bumpPackageVersion(content: string, currentValue: string, bumpVersion: ReleaseType | string): BumpPackageVersionResult;
