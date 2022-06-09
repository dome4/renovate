import * as semver from 'semver';
export declare function makeVersion(version: string, options: semver.Options): string | boolean | null;
export declare function cleanVersion(version: string): string;
export declare function getOptions(input: string): {
    loose: boolean;
    includePrerelease: boolean;
};
export declare function containsOperators(input: string): boolean;
export declare function matchesWithOptions(version: string, cleanRange: string, options: semver.Options): boolean;
export declare function findSatisfyingVersion(versions: string[], range: string, compareRt: number): string | null;
