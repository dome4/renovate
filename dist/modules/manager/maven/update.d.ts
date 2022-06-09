import { ReleaseType } from 'semver';
import type { BumpPackageVersionResult, UpdateDependencyConfig, Upgrade } from '../types';
export declare function updateAtPosition(fileContent: string, upgrade: Upgrade, endingAnchor: string): string | null;
export declare function updateDependency({ fileContent, upgrade, }: UpdateDependencyConfig): string | null;
export declare function bumpPackageVersion(content: string, currentValue: string | undefined, bumpVersion: ReleaseType | string): BumpPackageVersionResult;
