import type { ApiPageCache, ApiPageItem } from './types';
export declare class ApiCache<T extends ApiPageItem> {
    private cache;
    private itemsMapCache;
    constructor(cache: ApiPageCache<T>);
    get etag(): string | null;
    set etag(value: string | null);
    /**
     * @returns Date formatted to use in HTTP headers
     */
    get lastModified(): string | null;
    getItems(): T[];
    getItems<U = unknown>(mapFn: (_: T) => U): U[];
    getItem(number: number): T | null;
    /**
     * It intentionally doesn't alter `lastModified` cache field.
     *
     * The point is to allow cache modifications during run, but
     * force fetching and refreshing of modified items next run.
     */
    updateItem(item: T): void;
    /**
     * Copies items from `page` to `cache`.
     * Updates internal cache timestamp.
     *
     * @param cache Cache object
     * @param page List of cacheable items, sorted by `updated_at` field
     * starting from the most recently updated.
     * @returns `true` when the next page is likely to contain fresh items,
     * otherwise `false`.
     */
    reconcile(page: T[]): boolean;
}
