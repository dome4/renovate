import type { GraphqlOptions, HttpResponse, InternalHttpOptions } from './types';
import { Http } from '.';
export declare const setBaseUrl: (url: string) => void;
interface GithubInternalOptions extends InternalHttpOptions {
    body?: string;
}
export interface GithubHttpOptions extends InternalHttpOptions {
    paginate?: boolean | string;
    paginationField?: string;
    pageLimit?: number;
    token?: string;
}
export interface GithubGraphqlResponse<T = unknown> {
    data?: T;
    errors?: {
        type?: string;
        message: string;
    }[];
}
export declare class GithubHttp extends Http<GithubHttpOptions, GithubHttpOptions> {
    constructor(hostType?: string, options?: GithubHttpOptions);
    protected request<T>(url: string | URL, options?: GithubInternalOptions & GithubHttpOptions, okToRetry?: boolean): Promise<HttpResponse<T>>;
    requestGraphql<T = unknown>(query: string, options?: GraphqlOptions): Promise<GithubGraphqlResponse<T> | null>;
    queryRepoField<T = Record<string, unknown>>(query: string, fieldName: string, options?: GraphqlOptions): Promise<T[]>;
}
export {};
