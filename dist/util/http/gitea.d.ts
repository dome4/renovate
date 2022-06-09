import type { HttpOptions, HttpResponse, InternalHttpOptions } from './types';
import { Http } from '.';
export declare const setBaseUrl: (newBaseUrl: string) => void;
export interface GiteaHttpOptions extends InternalHttpOptions {
    paginate?: boolean;
    token?: string;
}
export declare class GiteaHttp extends Http<GiteaHttpOptions, GiteaHttpOptions> {
    constructor(options?: HttpOptions);
    protected request<T>(path: string, options?: InternalHttpOptions & GiteaHttpOptions): Promise<HttpResponse<T>>;
}
