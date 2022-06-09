import type { GithubHttp } from '../../../util/http/github';
import { AbstractGithubDatasourceCache } from '../github-releases/cache/cache-base';
import type { CacheOptions, StoredItemBase } from '../github-releases/cache/types';
export interface FetchedTag {
    version: string;
    target: {
        type: 'Commit';
        hash: string;
        releaseTimestamp: string;
    } | {
        type: 'Tag';
        target: {
            hash: string;
            releaseTimestamp: string;
        };
    };
}
export interface StoredTag extends StoredItemBase {
    hash: string;
    releaseTimestamp: string;
}
export declare class CacheableGithubTags extends AbstractGithubDatasourceCache<StoredTag, FetchedTag> {
    readonly cacheNs = "github-datasource-graphql-tags";
    readonly graphqlQuery = "\nquery ($owner: String!, $name: String!, $cursor: String, $count: Int!) {\n  repository(owner: $owner, name: $name) {\n    payload: refs(\n      first: $count\n      after: $cursor\n      orderBy: {field: TAG_COMMIT_DATE, direction: DESC}\n      refPrefix: \"refs/tags/\"\n    ) {\n      nodes {\n        version: name\n        target {\n          type: __typename\n          ... on Commit {\n            hash: oid\n            releaseTimestamp: committedDate\n          }\n          ... on Tag {\n            target {\n              ... on Commit {\n                hash: oid\n                releaseTimestamp: committedDate\n              }\n            }\n          }\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n}\n";
    constructor(http: GithubHttp, opts?: CacheOptions);
    coerceFetched(item: FetchedTag): StoredTag | null;
}
