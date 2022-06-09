export interface DistroSchedule {
    codename: string;
    series: string;
    created: string;
    release: string;
    eol: string;
    eol_server?: string;
    eol_esm?: string;
    eol_lts?: string;
    eol_elts?: string;
}
export declare type DistroDataFile = 'data/ubuntu-distro-info.json' | 'data/debian-distro-info.json';
export declare type DistroInfoRecord = Record<string, DistroSchedule>;
export declare type DistroInfoRecordWithVersion = {
    version: string;
} & DistroSchedule;
export declare class DistroInfo {
    private readonly _codenameToVersion;
    private readonly _sortedInfo;
    private readonly _distroInfo;
    constructor(distroJsonKey: DistroDataFile);
    /**
     * Check if input is a valid release codename
     * @param input A codename
     * @returns true if input is a codename, false otherwise
     */
    isCodename(input: string): boolean;
    /**
     * Checks if given input string is a valid release version
     * @param input A codename/semVer
     * @returns true if release exists, false otherwise
     */
    exists(input: string): boolean;
    /**
     * Get semVer representation of a given codename
     * @param input A codename
     * @returns A semVer if exists, otherwise input string is returned
     */
    getVersionByCodename(input: string): string;
    /**
     * Get codename representation of a given semVer
     * @param input A semVer
     * @returns A codename if exists, otherwise input string is returned
     */
    getCodenameByVersion(input: string): string;
    /**
     * Get schedule of a given release
     * @param input A codename/semVer
     * @returns A schedule if available, otherwise undefined
     */
    getSchedule(input: string): DistroSchedule | null;
    /**
     * Check if a given release has passed its EOL
     * @param input A codename/semVer
     * @returns false if still supported, true otherwise
     */
    isEolLts(input: string): boolean;
    /**
     * Check if a given version has been released
     * @param input A codename/semVer
     * @returns false if unreleased or has no schedule, true otherwise
     */
    isReleased(input: string): boolean;
    /**
     * Get distro info for the release that has N other newer releases.
     * Example: n=0 corresponds to the latest available release, n=1 the release before, etc.
     * In Debian terms: N = 0 -> stable, N = 1 -> oldstable, N = 2 -> oldoldstalbe
     * @param n
     * @returns Distro info of the Nth latest release
     */
    getNLatest(n: number): DistroInfoRecordWithVersion | null;
}
