import type { Opt, ToolConstraint } from './types';
export declare function supportsDynamicInstall(toolName: string): boolean;
export declare function isBuildpack(): boolean;
export declare function isDynamicInstall(toolConstraints?: Opt<ToolConstraint[]>): boolean;
export declare function resolveConstraint(toolConstraint: ToolConstraint): Promise<string>;
export declare function generateInstallCommands(toolConstraints: Opt<ToolConstraint[]>): Promise<string[]>;
