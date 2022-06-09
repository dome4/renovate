import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import type { MavenDependency, ReleaseMap } from './types';
export declare const defaultRegistryUrls: string[];
export declare class MavenDatasource extends Datasource {
    static id: string;
    readonly defaultRegistryUrls: string[];
    readonly defaultVersioning = "maven";
    readonly registryStrategy = "merge";
    constructor(id?: string);
    fetchReleasesFromMetadata(dependency: MavenDependency, repoUrl: string): Promise<ReleaseMap>;
    addReleasesFromIndexPage(inputReleaseMap: ReleaseMap, dependency: MavenDependency, repoUrl: string): Promise<ReleaseMap>;
    /**
     *
     * Double-check releases using HEAD request and
     * attach timestamps obtained from `Last-Modified` header.
     *
     * Example input:
     *
     * {
     *   '1.0.0': {
     *     version: '1.0.0',
     *     releaseTimestamp: '2020-01-01T01:00:00.000Z',
     *   },
     *   '1.0.1': null,
     * }
     *
     * Example output:
     *
     * {
     *   '1.0.0': {
     *     version: '1.0.0',
     *     releaseTimestamp: '2020-01-01T01:00:00.000Z',
     *   },
     *   '1.0.1': {
     *     version: '1.0.1',
     *     releaseTimestamp: '2021-01-01T01:00:00.000Z',
     *   }
     * }
     *
     * It should validate `1.0.0` with HEAD request, but leave `1.0.1` intact.
     *
     */
    addReleasesUsingHeadRequests(inputReleaseMap: ReleaseMap, dependency: MavenDependency, repoUrl: string): Promise<ReleaseMap>;
    getReleasesFromMap(releaseMap: ReleaseMap): Release[];
    getReleases({ packageName, registryUrl, }: GetReleasesConfig): Promise<ReleaseResult | null>;
}
