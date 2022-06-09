export declare type BitbucketTag = {
    name: string;
    target?: {
        date?: string;
        hash: string;
    };
};
export declare type BitbucketCommit = {
    hash: string;
    date?: string;
};
