"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPackageFile = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const regex_1 = require("../../../util/regex");
const bitbucket_tags_1 = require("../../datasource/bitbucket-tags");
const clojure_1 = require("../../datasource/clojure");
const common_1 = require("../../datasource/clojure/common");
const git_refs_1 = require("../../datasource/git-refs");
const github_tags_1 = require("../../datasource/github-tags");
const gitlab_tags_1 = require("../../datasource/gitlab-tags");
const common_2 = require("../../datasource/maven/common");
const parser_1 = require("./parser");
const dependencyRegex = (0, regex_1.regEx)(/^(?<groupId>[a-zA-Z][-_a-zA-Z0-9]*(?:\.[a-zA-Z0-9][-_a-zA-Z0-9]*)*)(?:\/(?<artifactId>[a-zA-Z][-_a-zA-Z0-9]*(?:\.[a-zA-Z0-9][-_a-zA-Z0-9]*)*))?$/);
function getPackageName(depName) {
    const matchGroups = dependencyRegex.exec(depName)?.groups;
    if (matchGroups) {
        const groupId = matchGroups.groupId;
        const artifactId = matchGroups.artifactId
            ? matchGroups.artifactId
            : groupId;
        return `${groupId}:${artifactId}`;
    }
    return null;
}
const githubDependencyRegex = (0, regex_1.regEx)(/^(?:com|io)\.github\.(?<packageName>[^/]+\/[^/]+)$/);
const gitlabDependencyRegex = (0, regex_1.regEx)(/^(?:com|io)\.gitlab\.(?<packageName>[^/]+\/[^/]+)$/);
const bitbucketDependencyRegex = (0, regex_1.regEx)(/^(?:org|io)\.bitbucket\.(?<packageName>[^/]+\/[^/]+)$/);
function resolveGitPackageFromEdnKey(dep, key) {
    if (dep.datasource) {
        return;
    }
    const githubDependencyGroups = githubDependencyRegex.exec(key)?.groups;
    if (githubDependencyGroups?.packageName) {
        dep.datasource = github_tags_1.GithubTagsDatasource.id;
        dep.packageName = githubDependencyGroups.packageName;
        return;
    }
    const gitlabDependencyGroups = gitlabDependencyRegex.exec(key)?.groups;
    if (gitlabDependencyGroups?.packageName) {
        dep.datasource = gitlab_tags_1.GitlabTagsDatasource.id;
        dep.packageName = gitlabDependencyGroups.packageName;
        return;
    }
    const bitbucketDependencyGroups = bitbucketDependencyRegex.exec(key)?.groups;
    if (bitbucketDependencyGroups?.packageName) {
        dep.datasource = bitbucket_tags_1.BitBucketTagsDatasource.id;
        dep.packageName = bitbucketDependencyGroups.packageName;
        return;
    }
}
const githubUrlRegex = (0, regex_1.regEx)(/^(?:https:\/\/|git@)github\.com[/:](?<packageName>[^/]+\/[^/]+?)(?:\.git)?$/);
const gitlabUrlRegex = (0, regex_1.regEx)(/^(?:https:\/\/|git@)gitlab\.com[/:](?<packageName>[^/]+\/[^/]+?)(?:\.git)?$/);
const bitbucketUrlRegex = (0, regex_1.regEx)(/^(?:https:\/\/|git@)bitbucket\.org[/:](?<packageName>[^/]+\/[^/]+?)(?:\.git)?$/);
function resolveGitPackageFromEdnVal(dep, val) {
    const gitUrl = val['git/url'];
    if (!is_1.default.string(gitUrl)) {
        return;
    }
    const githubMatchGroups = githubUrlRegex.exec(gitUrl)?.groups;
    if (githubMatchGroups) {
        dep.datasource = github_tags_1.GithubTagsDatasource.id;
        dep.packageName = githubMatchGroups.packageName;
        dep.sourceUrl = `https://github.com/${dep.packageName}`;
        return;
    }
    const gitlabMatchGroups = gitlabUrlRegex.exec(gitUrl)?.groups;
    const bitbucketMatchGroups = bitbucketUrlRegex.exec(gitUrl)?.groups;
    if (gitlabMatchGroups) {
        dep.datasource = gitlab_tags_1.GitlabTagsDatasource.id;
        dep.packageName = gitlabMatchGroups.packageName;
        dep.sourceUrl = `https://gitlab.com/${dep.packageName}`;
        return;
    }
    if (bitbucketMatchGroups) {
        dep.datasource = gitlab_tags_1.GitlabTagsDatasource.id;
        dep.packageName = bitbucketMatchGroups.packageName;
        dep.sourceUrl = `https://bitbucket.org/${dep.packageName}`;
        return;
    }
    dep.datasource = git_refs_1.GitRefsDatasource.id;
    dep.packageName = gitUrl;
    if (gitUrl.startsWith('https://')) {
        dep.sourceUrl = gitUrl.replace(/\.git$/, '');
    }
}
function extractDependency(key, val, metadata, mavenRegistries, depType) {
    if (!is_1.default.plainObject(val)) {
        return null;
    }
    const packageName = getPackageName(key);
    if (!packageName) {
        return null;
    }
    const depName = key;
    const dep = {
        depName,
        packageName,
        currentValue: null,
        ...metadata.get(val),
    };
    if (depType) {
        dep.depType = depType;
    }
    const mvnVersion = val['mvn/version'];
    if (is_1.default.string(mvnVersion)) {
        dep.datasource = clojure_1.ClojureDatasource.id;
        dep.currentValue = mvnVersion;
        dep.packageName = packageName.replace('/', ':');
        dep.registryUrls = [...mavenRegistries];
        return dep;
    }
    resolveGitPackageFromEdnVal(dep, val);
    resolveGitPackageFromEdnKey(dep, key);
    if (dep.datasource) {
        const gitTag = val['git/tag'];
        if (is_1.default.string(gitTag)) {
            dep.currentValue = gitTag;
        }
        const gitSha = val['git/sha'] ?? val['sha'];
        if (is_1.default.string(gitSha)) {
            dep.currentDigest = gitSha;
            dep.currentDigestShort = gitSha.slice(0, 7);
        }
        return dep;
    }
    return null;
}
function extractSection(section, metadata, mavenRegistries, depType) {
    const deps = [];
    if (is_1.default.plainObject(section)) {
        for (const [key, val] of Object.entries(section)) {
            const dep = extractDependency(key, val, metadata, mavenRegistries, depType);
            if (dep) {
                deps.push(dep);
            }
        }
    }
    return deps;
}
function extractPackageFile(content) {
    const parsed = (0, parser_1.parseDepsEdnFile)(content);
    if (!parsed) {
        return null;
    }
    const { data, metadata } = parsed;
    const deps = [];
    // See: https://clojure.org/reference/deps_and_cli#_modifying_the_default_repositories
    const registryMap = {
        clojars: common_1.CLOJARS_REPO,
        central: common_2.MAVEN_REPO,
    };
    const mavenRepos = data['mvn/repos'];
    if (is_1.default.plainObject(mavenRepos)) {
        for (const [repoName, repoSpec] of Object.entries(mavenRepos)) {
            if (is_1.default.string(repoName)) {
                if (is_1.default.plainObject(repoSpec) && is_1.default.string(repoSpec.url)) {
                    registryMap[repoName] = repoSpec.url;
                }
                else if (is_1.default.string(repoSpec) && repoSpec === 'nil') {
                    delete registryMap[repoName];
                }
            }
        }
    }
    const mavenRegistries = [...Object.values(registryMap)];
    deps.push(...extractSection(data['deps'], metadata, mavenRegistries));
    const aliases = data['aliases'];
    if (is_1.default.plainObject(aliases)) {
        for (const [depType, aliasSection] of Object.entries(aliases)) {
            if (is_1.default.plainObject(aliasSection)) {
                deps.push(...extractSection(aliasSection['extra-deps'], metadata, mavenRegistries, depType));
                deps.push(...extractSection(aliasSection['override-deps'], metadata, mavenRegistries, depType));
            }
        }
    }
    return { deps };
}
exports.extractPackageFile = extractPackageFile;
//# sourceMappingURL=extract.js.map