import { Http } from '../../util/http';
import type { HttpError } from '../../util/http';
import type { DatasourceApi, DigestConfig, GetReleasesConfig, ReleaseResult } from './types';
export declare abstract class Datasource implements DatasourceApi {
    readonly id: string;
    protected constructor(id: string);
    caching: boolean | undefined;
    customRegistrySupport: boolean;
    defaultConfig: Record<string, unknown> | undefined;
    defaultRegistryUrls: string[] | undefined;
    defaultVersioning: string | undefined;
    registryStrategy: 'first' | 'hunt' | 'merge' | undefined;
    protected http: Http;
    abstract getReleases(getReleasesConfig: GetReleasesConfig): Promise<ReleaseResult | null>;
    getDigest?(config: DigestConfig, newValue?: string): Promise<string | null>;
    handleSpecificErrors(err: HttpError): void;
    protected handleGenericErrors(err: HttpError): never;
}
