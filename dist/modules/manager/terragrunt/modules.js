"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyseTerragruntModule = exports.extractTerragruntModule = exports.gitTagsRefMatchRegex = exports.githubRefMatchRegex = void 0;
const logger_1 = require("../../../logger");
const regex_1 = require("../../../util/regex");
const git_tags_1 = require("../../datasource/git-tags");
const github_tags_1 = require("../../datasource/github-tags");
const terraform_module_1 = require("../../datasource/terraform-module");
const common_1 = require("./common");
const providers_1 = require("./providers");
exports.githubRefMatchRegex = (0, regex_1.regEx)(/github\.com([/:])(?<project>[^/]+\/[a-z0-9-_.]+).*\?ref=(?<tag>.*)$/i);
exports.gitTagsRefMatchRegex = (0, regex_1.regEx)(/(?:git::)?(?<url>(?:http|https|ssh):\/\/(?:.*@)?(?<path>.*.*\/(?<project>.*\/.*)))\?ref=(?<tag>.*)$/);
const hostnameMatchRegex = (0, regex_1.regEx)(/^(?<hostname>([\w|\d]+\.)+[\w|\d]+)/);
function extractTerragruntModule(startingLine, lines) {
    const moduleName = 'terragrunt';
    const result = (0, providers_1.extractTerragruntProvider)(startingLine, lines, moduleName);
    result.dependencies.forEach((dep) => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        dep.managerData.terragruntDependencyType =
            common_1.TerragruntDependencyTypes.terragrunt;
    });
    return result;
}
exports.extractTerragruntModule = extractTerragruntModule;
function analyseTerragruntModule(dep) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const source = dep.managerData.source;
    const githubRefMatch = exports.githubRefMatchRegex.exec(source ?? '');
    const gitTagsRefMatch = exports.gitTagsRefMatchRegex.exec(source ?? '');
    if (githubRefMatch?.groups) {
        dep.depType = 'github';
        dep.packageName = githubRefMatch.groups.project.replace((0, regex_1.regEx)(/\.git$/), '');
        dep.depName = 'github.com/' + dep.packageName;
        dep.currentValue = githubRefMatch.groups.tag;
        dep.datasource = github_tags_1.GithubTagsDatasource.id;
    }
    else if (gitTagsRefMatch?.groups) {
        dep.depType = 'gitTags';
        if (gitTagsRefMatch.groups.path.includes('//')) {
            logger_1.logger.debug('Terragrunt module contains subdirectory');
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
            dep.depType = 'terragrunt';
            dep.depName = moduleParts.join('/');
            dep.datasource = terraform_module_1.TerraformModuleDatasource.id;
        }
    }
    else {
        logger_1.logger.debug({ dep }, 'terragrunt dep has no source');
        dep.skipReason = 'no-source';
    }
}
exports.analyseTerragruntModule = analyseTerragruntModule;
//# sourceMappingURL=modules.js.map