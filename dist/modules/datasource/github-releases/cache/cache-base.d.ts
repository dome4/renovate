import type { GithubHttp } from '../../../../util/http/github';
import type { GetReleasesConfig } from '../../types';
import type { CacheOptions, StoredItemBase } from './types';
export declare abstract class AbstractGithubDatasourceCache<StoredItem extends StoredItemBase, FetchedItem = unknown> {
    private http;
    private updateDuration;
    private packageFreshDaysDuration;
    private updateDurationFresh;
    private resetDuration;
    private stabilityDuration;
    private maxPrefetchPages;
    private itemsPerPrefetchPage;
    private maxUpdatePages;
    private itemsPerUpdatePage;
    private resetDeltaMinutes;
    constructor(http: GithubHttp, opts?: CacheOptions);
    /**
     * The key at which data is stored in the package cache.
     */
    abstract readonly cacheNs: string;
    /**
     * The query string.
     * For parameters, see `GithubQueryParams`.
     */
    abstract readonly graphqlQuery: string;
    /**
     * Transform `fetchedItem` for storing in the package cache.
     * @param fetchedItem Node obtained from GraphQL response
     */
    abstract coerceFetched(fetchedItem: FetchedItem): StoredItem | null;
    /**
     * Pre-fetch, update, or just return the package cache items.
     */
    getItems(releasesConfig: GetReleasesConfig): Promise<StoredItem[]>;
    getRandomDeltaMinutes(): number;
    getLastReleaseTimestamp(items: Record<string, StoredItem>): string | null;
}
