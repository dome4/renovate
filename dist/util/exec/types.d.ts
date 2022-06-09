/// <reference types="node" />
import type { ExecOptions as ChildProcessExecOptions } from 'child_process';
export interface ToolConstraint {
    toolName: string;
    constraint?: string | null;
}
export interface ToolConfig {
    datasource: string;
    depName: string;
    hash?: boolean;
    versioning: string;
}
export declare type Opt<T> = T | null | undefined;
export declare type VolumesPair = [string, string];
export declare type VolumeOption = Opt<string | VolumesPair>;
export interface DockerOptions {
    image: string;
    tag?: Opt<string>;
    tagScheme?: Opt<string>;
    tagConstraint?: Opt<string>;
    volumes?: Opt<VolumeOption[]>;
    envVars?: Opt<Opt<string>[]>;
    cwd?: Opt<string>;
}
export interface RawExecOptions extends ChildProcessExecOptions {
    encoding: string;
}
export interface ExecResult {
    stdout: string;
    stderr: string;
}
export declare type ExtraEnv<T = unknown> = Record<string, T>;
export interface ExecOptions {
    cwd?: string;
    cwdFile?: string;
    env?: Opt<ExtraEnv>;
    extraEnv?: Opt<ExtraEnv>;
    docker?: Opt<DockerOptions>;
    toolConstraints?: Opt<ToolConstraint[]>;
    preCommands?: Opt<string[]>;
    maxBuffer?: number | undefined;
    timeout?: number | undefined;
}
