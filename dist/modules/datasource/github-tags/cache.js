"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheableGithubTags = void 0;
const cache_base_1 = require("../github-releases/cache/cache-base");
const query = `
query ($owner: String!, $name: String!, $cursor: String, $count: Int!) {
  repository(owner: $owner, name: $name) {
    payload: refs(
      first: $count
      after: $cursor
      orderBy: {field: TAG_COMMIT_DATE, direction: DESC}
      refPrefix: "refs/tags/"
    ) {
      nodes {
        version: name
        target {
          type: __typename
          ... on Commit {
            hash: oid
            releaseTimestamp: committedDate
          }
          ... on Tag {
            target {
              ... on Commit {
                hash: oid
                releaseTimestamp: committedDate
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}
`;
class CacheableGithubTags extends cache_base_1.AbstractGithubDatasourceCache {
    constructor(http, opts = {}) {
        super(http, opts);
        this.cacheNs = 'github-datasource-graphql-tags';
        this.graphqlQuery = query;
    }
    coerceFetched(item) {
        const { version, target } = item;
        if (target.type === 'Commit') {
            const { hash, releaseTimestamp } = target;
            return { version, hash, releaseTimestamp };
        }
        else if (target.type === 'Tag') {
            const { hash, releaseTimestamp } = target.target;
            return { version, hash, releaseTimestamp };
        }
        return null;
    }
}
exports.CacheableGithubTags = CacheableGithubTags;
//# sourceMappingURL=cache.js.map