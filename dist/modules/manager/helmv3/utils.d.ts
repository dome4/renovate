import type { PackageDependency } from '../types';
import type { ChartDefinition, Repository } from './types';
export declare function parseRepository(depName: string, repositoryURL: string): PackageDependency;
/**
 * Resolves alias in repository string.
 *
 * @param repository to be resolved string
 * @param aliases Records containing aliases as key and to be resolved URLs as values
 *
 * @returns  resolved alias. If repository does not contain an alias the repository string will be returned. Should it contain an alias which can not be resolved using `aliases`, null will be returned
 */
export declare function resolveAlias(repository: string, aliases: Record<string, string>): string | null;
export declare function getRepositories(definitions: ChartDefinition[]): Repository[];
export declare function isAlias(repository: string): boolean;
export declare function isOCIRegistry(repository: Repository): boolean;
export declare function aliasRecordToRepositories(aliases: Record<string, string>): Repository[];
