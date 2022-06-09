/// <reference types="node" />
import type { Stats } from 'fs';
import type { GradleVersionExtract } from './types';
export declare const extraEnv: {
    GRADLE_OPTS: string;
};
export declare function gradleWrapperFileName(): string;
export declare function prepareGradleCommand(gradlewName: string, cwd: string, gradlew: Stats | null, args: string | null): Promise<string | null>;
/**
 * Find compatible java version for gradle.
 * see https://docs.gradle.org/current/userguide/compatibility.html
 * @param gradleVersion current gradle version
 * @returns A Java semver range
 */
export declare function getJavaContraint(gradleVersion: string): string | null;
export declare function getJavaVersioning(): string;
export declare function extractGradleVersion(fileContent: string): GradleVersionExtract | null;
