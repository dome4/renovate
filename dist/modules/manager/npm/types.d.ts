interface LockFilePackage {
    name?: string;
    version?: string;
    resolved?: string;
    integrity?: string;
    link?: boolean;
    dev?: boolean;
    optional?: boolean;
    devOptional?: boolean;
    inBundle?: boolean;
    hasInstallScript?: boolean;
    hasShrinkwrap?: boolean;
    bin?: string | Record<string, string>;
    license?: string;
    engines?: Record<string, string>;
    dependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
}
interface LockFileDependency {
    version: string;
    integrity: string;
    resolved: string;
    bundled?: boolean;
    dev?: boolean;
    optional?: boolean;
    requires?: Record<string, string>;
    dependencies?: Record<string, LockFileDependency>;
}
interface LockFileBase {
    name?: string;
    version?: string;
    requires?: boolean;
}
interface LockFile1 extends LockFileBase {
    lockfileVersion: 1;
    packageIntegrity?: string;
    preserveSymlinks?: string;
    dependencies?: Record<string, LockFileDependency>;
}
interface LockFile2 extends LockFileBase {
    lockfileVersion: 2;
    packages: Record<string, LockFilePackage>;
    dependencies?: Record<string, LockFileDependency>;
}
interface LockFile3 extends LockFileBase {
    lockfileVersion: 3;
    packages: Record<string, LockFilePackage>;
}
export declare type LockFile = LockFile1 | LockFile2 | LockFile3;
export interface ParseLockFileResult {
    detectedIndent: string;
    lockFileParsed: LockFile | undefined;
}
export declare type NpmDepType = 'dependencies' | 'devDependencies' | 'optionalDependencies' | 'overrides' | 'peerDependencies' | 'resolutions';
export interface NpmManagerData extends Record<string, any> {
    hasPackageManager?: boolean;
    lernaJsonFile?: string;
    parents?: string[];
    yarnZeroInstall?: boolean;
}
export {};
