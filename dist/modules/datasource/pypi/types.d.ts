export declare type PypiJSONRelease = {
    requires_python?: string;
    upload_time?: string;
    yanked?: boolean;
};
export declare type Releases = Record<string, PypiJSONRelease[]>;
export declare type PypiJSON = {
    info: {
        name: string;
        home_page?: string;
        project_urls?: Record<string, string>;
    };
    releases?: Releases;
};
