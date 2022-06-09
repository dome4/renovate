"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPackageFile = exports.parseKustomize = exports.extractHelmChart = exports.extractImage = exports.extractResource = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const js_yaml_1 = require("js-yaml");
const logger_1 = require("../../../logger");
const regex_1 = require("../../../util/regex");
const docker_1 = require("../../datasource/docker");
const git_tags_1 = require("../../datasource/git-tags");
const github_tags_1 = require("../../datasource/github-tags");
const helm_1 = require("../../datasource/helm");
const extract_1 = require("../dockerfile/extract");
// URL specifications should follow the hashicorp URL format
// https://github.com/hashicorp/go-getter#url-format
const gitUrl = (0, regex_1.regEx)(/^(?:git::)?(?<url>(?:(?:(?:http|https|ssh):\/\/)?(?:.*@)?)?(?<path>(?:[^:/\s]+(?::[0-9]+)?[:/])?(?<project>[^/\s]+\/[^/\s]+)))(?<subdir>[^?\s]*)\?ref=(?<currentValue>.+)$/);
function extractResource(base) {
    const match = gitUrl.exec(base);
    if (!match?.groups) {
        return null;
    }
    const { path } = match.groups;
    if (path.startsWith('github.com:') || path.startsWith('github.com/')) {
        return {
            currentValue: match.groups.currentValue,
            datasource: github_tags_1.GithubTagsDatasource.id,
            depName: match.groups.project.replace('.git', ''),
        };
    }
    return {
        datasource: git_tags_1.GitTagsDatasource.id,
        depName: path.replace('.git', ''),
        packageName: match.groups.url,
        currentValue: match.groups.currentValue,
    };
}
exports.extractResource = extractResource;
function extractImage(image) {
    if (!image.name) {
        return null;
    }
    const nameDep = (0, extract_1.splitImageParts)(image.newName ?? image.name);
    const { depName } = nameDep;
    const { digest, newTag } = image;
    if (digest && newTag) {
        logger_1.logger.warn({ newTag, digest }, 'Kustomize ignores newTag when digest is provided. Pick one, or use `newTag: tag@digest`');
        return {
            depName,
            currentValue: newTag,
            currentDigest: digest,
            skipReason: 'invalid-dependency-specification',
        };
    }
    if (digest) {
        if (!is_1.default.string(digest) || !digest.startsWith('sha256:')) {
            return {
                depName,
                currentValue: digest,
                skipReason: 'invalid-value',
            };
        }
        return {
            datasource: docker_1.DockerDatasource.id,
            depName,
            currentValue: nameDep.currentValue,
            currentDigest: digest,
            replaceString: digest,
        };
    }
    if (newTag) {
        if (!is_1.default.string(newTag) || newTag.startsWith('sha256:')) {
            return {
                depName,
                currentValue: newTag,
                skipReason: 'invalid-value',
            };
        }
        const dep = (0, extract_1.splitImageParts)(`${depName}:${newTag}`);
        return {
            ...dep,
            datasource: docker_1.DockerDatasource.id,
            replaceString: newTag,
        };
    }
    if (image.newName) {
        return {
            ...nameDep,
            datasource: docker_1.DockerDatasource.id,
            replaceString: image.newName,
        };
    }
    return null;
}
exports.extractImage = extractImage;
function extractHelmChart(helmChart) {
    if (!helmChart.name) {
        return null;
    }
    return {
        depName: helmChart.name,
        currentValue: helmChart.version,
        registryUrls: [helmChart.repo],
        datasource: helm_1.HelmDatasource.id,
    };
}
exports.extractHelmChart = extractHelmChart;
function parseKustomize(content) {
    let pkg = null;
    try {
        pkg = (0, js_yaml_1.load)(content, { json: true });
    }
    catch (e) /* istanbul ignore next */ {
        return null;
    }
    if (!pkg) {
        return null;
    }
    pkg.kind ?? (pkg.kind = 'Kustomization');
    if (!['Kustomization', 'Component'].includes(pkg.kind)) {
        return null;
    }
    return pkg;
}
exports.parseKustomize = parseKustomize;
function extractPackageFile(content) {
    logger_1.logger.trace('kustomize.extractPackageFile()');
    const deps = [];
    const pkg = parseKustomize(content);
    if (!pkg) {
        return null;
    }
    // grab the remote bases
    for (const base of pkg.bases ?? []) {
        const dep = extractResource(base);
        if (dep) {
            deps.push({
                ...dep,
                depType: pkg.kind,
            });
        }
    }
    // grab the remote resources
    for (const resource of pkg.resources ?? []) {
        const dep = extractResource(resource);
        if (dep) {
            deps.push({
                ...dep,
                depType: pkg.kind,
            });
        }
    }
    // grab the remote components
    for (const component of pkg.components ?? []) {
        const dep = extractResource(component);
        if (dep) {
            deps.push({
                ...dep,
                depType: pkg.kind,
            });
        }
    }
    // grab the image tags
    for (const image of pkg.images ?? []) {
        const dep = extractImage(image);
        if (dep) {
            deps.push({
                ...dep,
                depType: pkg.kind,
            });
        }
    }
    // grab the helm charts
    for (const helmChart of pkg.helmCharts ?? []) {
        const dep = extractHelmChart(helmChart);
        if (dep) {
            deps.push({
                ...dep,
                depType: 'HelmChart',
            });
        }
    }
    if (!deps.length) {
        return null;
    }
    return { deps };
}
exports.extractPackageFile = extractPackageFile;
//# sourceMappingURL=extract.js.map