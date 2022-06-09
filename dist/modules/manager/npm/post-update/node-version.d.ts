import type { PostUpdateConfig, Upgrade } from '../../types';
export declare function getNodeConstraint(config: Partial<PostUpdateConfig>): Promise<string | null>;
export declare function getNodeUpdate(upgrades: Upgrade[]): string | undefined;
