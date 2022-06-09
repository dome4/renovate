/// <reference types="node" />
import type { HostRule } from '../../types';
import type { AuthenticationRule } from './types';
/**
 * Add authorization to a Git Url and returns a new environment variables object
 * @returns a new NodeJS.ProcessEnv object without modifying any input parameters
 */
export declare function getGitAuthenticatedEnvironmentVariables(originalGitUrl: string, { token, hostType, matchHost }: HostRule, environmentVariables?: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
/**
 * Generates the authentication rules for later git usage for the given host
 * @link https://coolaj86.com/articles/vanilla-devops-git-credentials-cheatsheet/
 */
export declare function getAuthenticationRules(gitUrl: string, token: string): AuthenticationRule[];
