/// <reference types="node" />
import stream from 'stream';
import fs from 'fs-extra';
export * from './proxies';
export declare const pipeline: typeof stream.pipeline.__promisify__;
export declare function getSubDirectory(fileName: string): string;
export declare function getSiblingFileName(existingFileNameWithPath: string, otherFileName: string): string;
export declare function readLocalFile(fileName: string): Promise<Buffer>;
export declare function readLocalFile(fileName: string, encoding: 'utf8'): Promise<string>;
export declare function writeLocalFile(fileName: string, fileContent: string | Buffer): Promise<void>;
export declare function deleteLocalFile(fileName: string): Promise<void>;
export declare function renameLocalFile(fromFile: string, toFile: string): Promise<void>;
export declare function ensureDir(dirName: string): Promise<void>;
export declare function ensureLocalDir(dirName: string): Promise<void>;
export declare function ensureCacheDir(name: string): Promise<string>;
/**
 * Return the path of the private cache directory. This directory is wiped
 * between repositories, so they can be used to store private registries' index
 * without risk of that information leaking to other repositories/users.
 */
export declare function privateCacheDir(): string;
export declare function localPathExists(pathName: string): Promise<boolean>;
/**
 * Tries to find `otherFileName` in the directory where
 * `existingFileNameWithPath` is, then in its parent directory, then in the
 * grandparent, until we reach the top-level directory. All paths
 * must be relative to `localDir`.
 */
export declare function findLocalSiblingOrParent(existingFileNameWithPath: string, otherFileName: string): Promise<string | null>;
/**
 * Get files by name from directory
 */
export declare function readLocalDirectory(path: string): Promise<string[]>;
export declare function createWriteStream(path: string): fs.WriteStream;
export declare function localPathIsFile(pathName: string): Promise<boolean>;
/**
 * Find a file or directory by walking up parent directories within localDir
 */
export declare function findUpLocal(fileName: string | string[], cwd: string): Promise<string | null>;
