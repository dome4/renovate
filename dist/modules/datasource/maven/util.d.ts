import type { Http } from '../../../util/http';
import type { HttpResponse } from '../../../util/http/types';
import type { ReleaseResult } from '../types';
import type { HttpResourceCheckResult, MavenDependency, MavenXml } from './types';
export declare function downloadHttpProtocol(http: Http, pkgUrl: URL | string): Promise<Partial<HttpResponse>>;
export declare function downloadS3Protocol(pkgUrl: URL): Promise<string | null>;
export declare function checkS3Resource(pkgUrl: URL): Promise<HttpResourceCheckResult>;
export declare function checkResource(http: Http, pkgUrl: URL | string): Promise<HttpResourceCheckResult>;
export declare function getMavenUrl(dependency: MavenDependency, repoUrl: string, path: string): URL;
export declare function downloadMavenXml(http: Http, pkgUrl: URL | null): Promise<MavenXml>;
export declare function getDependencyParts(packageName: string): MavenDependency;
export declare function createUrlForDependencyPom(http: Http, version: string, dependency: MavenDependency, repoUrl: string): Promise<string>;
export declare function getDependencyInfo(http: Http, dependency: MavenDependency, repoUrl: string, version: string, recursionLimit?: number): Promise<Partial<ReleaseResult>>;
