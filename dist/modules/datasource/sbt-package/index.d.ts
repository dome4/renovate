import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
export declare class SbtPackageDatasource extends Datasource {
    static id: string;
    readonly defaultRegistryUrls: string[];
    readonly defaultVersioning = "ivy";
    readonly registryStrategy = "hunt";
    constructor(id?: string);
    getArtifactSubdirs(searchRoot: string, artifact: string, scalaVersion: string): Promise<string[] | null>;
    getPackageReleases(searchRoot: string, artifactSubdirs: string[] | null): Promise<string[] | null>;
    getUrls(searchRoot: string, artifactDirs: string[] | null, version: string | null): Promise<Partial<ReleaseResult>>;
    getReleases({ packageName, registryUrl, }: GetReleasesConfig): Promise<ReleaseResult | null>;
}
