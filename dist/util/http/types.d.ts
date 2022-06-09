/// <reference types="node" />
import type { IncomingHttpHeaders } from 'http';
import type { OptionsOfBufferResponseBody, OptionsOfJSONResponseBody } from 'got';
export declare type GotContextOptions = {
    authType?: string;
} & Record<string, unknown>;
export declare type GotOptions = GotBufferOptions | GotJSONOptions;
export declare type GotBufferOptions = OptionsOfBufferResponseBody & GotExtraOptions;
export declare type GotJSONOptions = OptionsOfJSONResponseBody & GotExtraOptions;
export declare type GotExtraOptions = {
    abortOnError?: boolean;
    abortIgnoreStatusCodes?: number[];
    token?: string;
    hostType?: string;
    enabled?: boolean;
    useCache?: boolean;
    noAuth?: boolean;
    context?: GotContextOptions;
};
export interface RequestStats {
    method: string;
    url: string;
    duration: number;
    queueDuration: number;
    statusCode: number;
}
export declare type OutgoingHttpHeaders = Record<string, string | string[] | undefined>;
export interface GraphqlVariables {
    [k: string]: unknown;
}
export interface GraphqlOptions {
    variables?: GraphqlVariables;
    paginate?: boolean;
    count?: number;
    limit?: number;
    cursor?: string | null;
    acceptHeader?: string;
}
export interface HttpOptions {
    body?: any;
    username?: string;
    password?: string;
    baseUrl?: string;
    headers?: OutgoingHttpHeaders;
    /**
     * Do not use authentication
     */
    noAuth?: boolean;
    throwHttpErrors?: boolean;
    useCache?: boolean;
}
export interface HttpPostOptions extends HttpOptions {
    body: unknown;
}
export interface InternalHttpOptions extends HttpOptions {
    json?: Record<string, unknown>;
    responseType?: 'json' | 'buffer';
    method?: 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head';
}
export interface HttpHeaders extends IncomingHttpHeaders {
    link?: string | undefined;
}
export interface HttpResponse<T = string> {
    statusCode: number;
    body: T;
    headers: HttpHeaders;
    authorization?: boolean;
}
