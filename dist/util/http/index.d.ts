/// <reference types="node" />
import { RequestError } from 'got';
import type { HttpOptions, HttpPostOptions, HttpResponse, InternalHttpOptions } from './types';
import './legacy';
export { RequestError as HttpError };
export declare class Http<GetOptions = HttpOptions, PostOptions = HttpPostOptions> {
    private hostType;
    private options?;
    constructor(hostType: string, options?: HttpOptions);
    protected request<T>(requestUrl: string | URL, httpOptions?: InternalHttpOptions): Promise<HttpResponse<T>>;
    get(url: string, options?: HttpOptions): Promise<HttpResponse>;
    head(url: string, options?: HttpOptions): Promise<HttpResponse>;
    protected requestBuffer(url: string | URL, httpOptions?: InternalHttpOptions): Promise<HttpResponse<Buffer> | null>;
    getBuffer(url: string, options?: HttpOptions): Promise<HttpResponse<Buffer> | null>;
    private requestJson;
    getJson<T = unknown>(url: string, options?: GetOptions): Promise<HttpResponse<T>>;
    headJson<T = unknown>(url: string, options?: GetOptions): Promise<HttpResponse<T>>;
    postJson<T = unknown>(url: string, options?: PostOptions): Promise<HttpResponse<T>>;
    putJson<T = unknown>(url: string, options?: PostOptions): Promise<HttpResponse<T>>;
    patchJson<T = unknown>(url: string, options?: PostOptions): Promise<HttpResponse<T>>;
    deleteJson<T = unknown>(url: string, options?: PostOptions): Promise<HttpResponse<T>>;
    stream(url: string, options?: HttpOptions): NodeJS.ReadableStream;
}
