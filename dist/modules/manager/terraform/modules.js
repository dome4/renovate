"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyseTerraformModule = exports.extractTerraformModule = exports.azureDevOpsSshRefMatchRegex = exports.gitTagsRefMatchRegex = exports.bitbucketRefMatchRegex = exports.githubRefMatchRegex = void 0;
const logger_1 = require("../../../logger");
const regex_1 = require("../../../util/regex");
const bitbucket_tags_1 = require("../../datasource/bitbucket-tags");
const git_tags_1 = require("../../datasource/git-tags");
const github_tags_1 = require("../../datasource/github-tags");
const terraform_module_1 = require("../../datasource/terraform-module");
const common_1 = require("./common");
const providers_1 = require("./providers");
exports.githubRefMatchRegex = (0, regex_1.regEx)(/github\.com([/:])(?<project>[^/]+\/[a-z0-9-_.]+).*\?ref=(?<tag>.*)$/i);
exports.bitbucketRefMatchRegex = (0, regex_1.regEx)(/(?:git::)?(?<url>(?:http|https|ssh)?(?::\/\/)?(?:.*@)?(?<path>bitbucket\.org\/(?<workspace>.*)\/(?<project>.*).git\/?(?<subfolder>.*)))\?ref=(?<tag>.*)$/);
exports.gitTagsRefMatchRegex = (0, regex_1.regEx)(/(?:git::)?(?<url>(?:(?:http|https|ssh):\/\/)?(?:.*@)?(?<path>.*\/(?<project>.*\/.*)))\?ref=(?<tag>.*)$/);
exports.azureDevOpsSshRefMatchRegex = (0, regex_1.regEx)(/(?:git::)?(?<url>git@ssh\.dev\.azure\.com:v3\/(?<organization>[^/]*)\/(?<project>[^/]*)\/(?<repository>[^/]*))(?<modulepath>.*)?\?ref=(?<tag>.*)$/);
const hostnameMatchRegex = (0, regex_1.regEx)(/^(?<hostname>([\w|\d]+\.)+[\w|\d]+)/);
function extractTerraformModule(startingLine, lines, moduleName) {
    const result = (0, providers_1.extractTerraformProvider)(startingLine, lines, moduleName);
    result.dependencies.forEach((dep) => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        dep.managerData.terraformDependencyType = common_1.TerraformDependencyTypes.module;
    });
    return result;
}
exports.extractTerraformModule = extractTerraformModule;
function analyseTerraformModule(dep) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const source = dep.managerData.source;
    const githubRefMatch = exports.githubRefMatchRegex.exec(source);
    const bitbucketRefMatch = exports.bitbucketRefMatchRegex.exec(source);
    const gitTagsRefMatch = exports.gitTagsRefMatchRegex.exec(source);
    const azureDevOpsSshRefMatch = exports.azureDevOpsSshRefMatchRegex.exec(source);
    if (githubRefMatch?.groups) {
        dep.packageName = githubRefMatch.groups.project.replace((0, regex_1.regEx)(/\.git$/), '');
        dep.depType = 'module';
        dep.depName = 'github.com/' + dep.packageName;
        dep.currentValue = githubRefMatch.groups.tag;
        dep.datasource = github_tags_1.GithubTagsDatasource.id;
    }
    else if (bitbucketRefMatch?.groups) {
        dep.depType = 'module';
        dep.depName =
            bitbucketRefMatch.groups.workspace +
                '/' +
                bitbucketRefMatch.groups.project;
        dep.packageName = dep.depName;
        dep.currentValue = bitbucketRefMatch.groups.tag;
        dep.datasource = bitbucket_tags_1.BitBucketTagsDatasource.id;
    }
    else if (azureDevOpsSshRefMatch?.groups) {
        dep.depType = 'module';
        dep.depName = `${azureDevOpsSshRefMatch.groups.organization}/${azureDevOpsSshRefMatch.groups.project}/${azureDevOpsSshRefMatch.groups.repository}${azureDevOpsSshRefMatch.groups.modulepath}`;
        dep.packageName = azureDevOpsSshRefMatch.groups.url;
        dep.currentValue = azureDevOpsSshRefMatch.groups.tag;
        dep.datasource = git_tags_1.GitTagsDatasource.id;
    }
    else if (gitTagsRefMatch?.groups) {
        dep.depType = 'module';
        if (gitTagsRefMatch.groups.path.includes('//')) {
            logger_1.logger.debug('Terraform module contains subdirectory');
            dep.depName = gitTagsRefMatch.groups.path.split('//')[0];
            const tempLookupName = gitTagsRefMatch.groups.url.split('//');
            dep.packageName = tempLookupName[0] + '//' + tempLookupName[1];
        }
        else {
            dep.depName = gitTagsRefMatch.groups.path.replace('.git', '');
            dep.packageName = gitTagsRefMatch.groups.url;
        }
        dep.currentValue = gitTagsRefMatch.groups.tag;
        dep.datasource = git_tags_1.GitTagsDatasource.id;
    }
    else if (source) {
        const moduleParts = source.split('//')[0].split('/');
        if (moduleParts[0] === '..') {
            dep.skipReason = 'local';
        }
        else if (moduleParts.length >= 3) {
            const hostnameMatch = hostnameMatchRegex.exec(source);
            if (hostnameMatch?.groups) {
                dep.registryUrls = [`https://${hostnameMatch.groups.hostname}`];
            }
            dep.depType = 'module';
            dep.depName = moduleParts.join('/');
            dep.datasource = terraform_module_1.TerraformModuleDatasource.id;
        }
    }
    else {
        logger_1.logger.debug({ dep }, 'terraform dep has no source');
        dep.skipReason = 'no-source';
    }
}
exports.analyseTerraformModule = analyseTerraformModule;
//# sourceMappingURL=modules.js.map