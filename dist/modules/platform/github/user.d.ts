import type { UserDetails } from './types';
export declare function getUserDetails(endpoint: string, token: string): Promise<UserDetails>;
export declare function getUserEmail(endpoint: string, token: string): Promise<string | null>;
