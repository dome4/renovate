import type { PackageDependency } from '../types';
import type { TokenType } from './common';
export interface GradleManagerData {
    fileReplacePosition?: number;
    packageFile?: string;
}
export interface VariableData extends GradleManagerData {
    key: string;
    value: string;
}
export declare type PackageVariables = Record<string, VariableData>;
export declare type VariableRegistry = Record<string, PackageVariables>;
export interface Token {
    type: TokenType;
    value: string;
    offset: number;
}
export interface StringInterpolation extends Token {
    type: TokenType.StringInterpolation;
    children: Token[];
    isComplete: boolean;
    isValid: boolean;
}
export interface SyntaxMatcher {
    matchType: TokenType | TokenType[];
    matchValue?: string | string[];
    lookahead?: boolean;
    tokenMapKey?: string;
}
export declare type TokenMap = Record<string, Token>;
export interface SyntaxHandlerInput {
    packageFile?: string;
    variables: PackageVariables;
    tokenMap: TokenMap;
}
export declare type SyntaxHandlerOutput = {
    deps?: PackageDependency<GradleManagerData>[];
    vars?: PackageVariables;
    urls?: string[];
} | null;
export interface SyntaxMatchConfig {
    matchers: SyntaxMatcher[];
    handler: (_: SyntaxHandlerInput) => SyntaxHandlerOutput;
}
export interface MatchConfig {
    tokens: Token[];
    variables: PackageVariables;
    packageFile?: string;
}
export interface ParseGradleResult {
    deps: PackageDependency<GradleManagerData>[];
    urls: string[];
    vars: PackageVariables;
}
export interface GradleCatalog {
    versions?: Record<string, GradleVersionPointerTarget>;
    libraries?: Record<string, GradleCatalogModuleDescriptor | GradleCatalogArtifactDescriptor | string>;
    plugins?: Record<string, GradleCatalogPluginDescriptor | string>;
}
export interface GradleCatalogModuleDescriptor {
    module: string;
    version?: GradleVersionCatalogVersion;
}
export interface GradleCatalogArtifactDescriptor {
    name: string;
    group: string;
    version?: GradleVersionCatalogVersion;
}
export interface GradleCatalogPluginDescriptor {
    id: string;
    version: GradleVersionCatalogVersion;
}
export interface VersionPointer {
    ref: string;
}
/**
 * Rich version declarations in Gradle version catalogs
 *
 * @see https://docs.gradle.org/current/userguide/rich_versions.html
 * @see https://docs.gradle.org/current/userguide/platforms.html#sub::toml-dependencies-format
 */
export interface RichVersion {
    require?: string;
    strictly?: string;
    prefer?: string;
    reject?: string[];
    rejectAll?: boolean;
}
export declare type GradleVersionPointerTarget = string | RichVersion;
export declare type GradleVersionCatalogVersion = string | VersionPointer | RichVersion;
