"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractAllPackageFiles = exports.extractPackageFile = void 0;
const js_yaml_1 = require("js-yaml");
const logger_1 = require("../../../logger");
const fs_1 = require("../../../util/fs");
const regex_1 = require("../../../util/regex");
const github_releases_1 = require("../../datasource/github-releases");
const helm_1 = require("../../datasource/helm");
const common_1 = require("./common");
function readManifest(content, file) {
    if ((0, common_1.isSystemManifest)(file)) {
        const versionMatch = (0, regex_1.regEx)(/#\s*Flux\s+Version:\s*(\S+)(?:\s*#\s*Components:\s*([A-Za-z,-]+))?/).exec(content);
        if (!versionMatch) {
            return null;
        }
        return {
            kind: 'system',
            file: file,
            version: versionMatch[1],
            components: versionMatch[2],
        };
    }
    const manifest = {
        kind: 'resource',
        file: file,
        releases: [],
        repositories: [],
    };
    let resources;
    try {
        resources = (0, js_yaml_1.loadAll)(content, null, { json: true });
    }
    catch (err) {
        logger_1.logger.debug({ err }, 'Failed to parse Flux manifest');
        return null;
    }
    // It's possible there are other non-Flux HelmRelease/HelmRepository CRs out there, so we filter based on apiVersion.
    for (const resource of resources) {
        switch (resource?.kind) {
            case 'HelmRelease':
                if (resource.apiVersion?.startsWith('helm.toolkit.fluxcd.io/') &&
                    resource.spec?.chart?.spec?.chart) {
                    manifest.releases.push(resource);
                }
                break;
            case 'HelmRepository':
                if (resource.apiVersion?.startsWith('source.toolkit.fluxcd.io/') &&
                    resource.metadata?.name &&
                    resource.metadata.namespace &&
                    resource.spec?.url) {
                    manifest.repositories.push(resource);
                }
                break;
        }
    }
    return manifest;
}
function resolveManifest(manifest, context) {
    const resourceManifests = context.filter((manifest) => manifest.kind === 'resource');
    const repositories = resourceManifests.flatMap((manifest) => manifest.repositories);
    let res = null;
    switch (manifest.kind) {
        case 'system':
            res = [
                {
                    depName: 'fluxcd/flux2',
                    datasource: github_releases_1.GithubReleasesDatasource.id,
                    currentValue: manifest.version,
                    managerData: {
                        components: manifest.components,
                    },
                },
            ];
            break;
        case 'resource':
            res = manifest.releases.map((release) => {
                const dep = {
                    depName: release.spec.chart.spec.chart,
                    currentValue: release.spec.chart.spec.version,
                    datasource: helm_1.HelmDatasource.id,
                };
                const matchingRepositories = repositories.filter((rep) => rep.kind === release.spec.chart.spec.sourceRef?.kind &&
                    rep.metadata.name === release.spec.chart.spec.sourceRef.name &&
                    rep.metadata.namespace ===
                        (release.spec.chart.spec.sourceRef.namespace ||
                            release.metadata?.namespace));
                if (matchingRepositories.length) {
                    dep.registryUrls = matchingRepositories.map((repo) => repo.spec.url);
                }
                else {
                    dep.skipReason = 'unknown-registry';
                }
                return dep;
            });
            break;
    }
    return res;
}
function extractPackageFile(content, packageFile) {
    const manifest = readManifest(content, packageFile);
    if (!manifest) {
        return null;
    }
    const deps = resolveManifest(manifest, [manifest]);
    return deps?.length ? { deps: deps } : null;
}
exports.extractPackageFile = extractPackageFile;
async function extractAllPackageFiles(_config, packageFiles) {
    const manifests = [];
    const results = [];
    for (const file of packageFiles) {
        const content = await (0, fs_1.readLocalFile)(file, 'utf8');
        const manifest = readManifest(content, file);
        if (manifest) {
            manifests.push(manifest);
        }
    }
    for (const manifest of manifests) {
        const deps = resolveManifest(manifest, manifests);
        if (deps?.length) {
            results.push({
                packageFile: manifest.file,
                deps: deps,
            });
        }
    }
    return results.length ? results : null;
}
exports.extractAllPackageFiles = extractAllPackageFiles;
//# sourceMappingURL=extract.js.map