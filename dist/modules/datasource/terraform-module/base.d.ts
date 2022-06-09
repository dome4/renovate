import type { HttpError } from '../../../util/http';
import { Datasource } from '../datasource';
import type { ServiceDiscoveryResult } from './types';
export declare abstract class TerraformDatasource extends Datasource {
    static id: string;
    getTerraformServiceDiscoveryResult(registryUrl: string): Promise<ServiceDiscoveryResult>;
    private static getDiscoveryUrl;
    handleSpecificErrors(err: HttpError): void;
}
