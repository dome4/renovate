/**
 * Parse versions like poetry.core.masonry.version.Version does (union of SemVer
 * and PEP440, with normalization of certain prerelease tags), and emit in SemVer
 * format. NOTE: this silently discards the epoch field in PEP440 versions, as
 * it has no equivalent in SemVer.
 */
export declare function poetry2semver(poetry_version: string, padRelease?: boolean): string | null;
/** Reverse normalizations applied by poetry2semver */
export declare function semver2poetry(version?: string): string | null;
/**
 * Translate a poetry-style version range to npm format
 *
 * This function works like cargo2npm, but it doesn't
 * add a '^', because poetry treats versions without operators as
 * exact versions.
 */
export declare function poetry2npm(input: string): string;
/**
 * Translate an npm-style version range to poetry format
 *
 * NOTE: This function is largely copied from cargo versioning code.
 * Poetry uses commas (like in cargo) instead of spaces (like in npm)
 * for AND operation.
 */
export declare function npm2poetry(range: string): string;
