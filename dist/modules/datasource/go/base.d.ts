import type { DataSource } from './types';
export declare class BaseGoDatasource {
    private static readonly gitlabHttpsRegExp;
    private static readonly gitlabRegExp;
    private static readonly id;
    private static readonly http;
    static getDatasource(goModule: string): Promise<DataSource | null>;
    private static goGetDatasource;
    private static goSourceHeader;
    private static goImportHeader;
}
