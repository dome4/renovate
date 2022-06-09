"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseGoDatasource = void 0;
const tslib_1 = require("tslib");
const url_1 = tslib_1.__importDefault(require("url"));
const constants_1 = require("../../../constants");
const logger_1 = require("../../../logger");
const hostRules = tslib_1.__importStar(require("../../../util/host-rules"));
const http_1 = require("../../../util/http");
const regex_1 = require("../../../util/regex");
const url_2 = require("../../../util/url");
const bitbucket_tags_1 = require("../bitbucket-tags");
const github_tags_1 = require("../github-tags");
const gitlab_tags_1 = require("../gitlab-tags");
// TODO: figure out class hierarchy (#10532)
class BaseGoDatasource {
    static async getDatasource(goModule) {
        if (goModule.startsWith('gopkg.in/')) {
            const [pkg] = goModule.replace('gopkg.in/', '').split('.');
            const packageName = pkg.includes('/') ? pkg : `go-${pkg}/${pkg}`;
            return {
                datasource: github_tags_1.GithubTagsDatasource.id,
                packageName,
                registryUrl: 'https://github.com',
            };
        }
        if (goModule.startsWith('github.com/')) {
            const split = goModule.split('/');
            const packageName = split[1] + '/' + split[2];
            return {
                datasource: github_tags_1.GithubTagsDatasource.id,
                packageName,
                registryUrl: 'https://github.com',
            };
        }
        if (goModule.startsWith('bitbucket.org/')) {
            const split = goModule.split('/');
            const packageName = split[1] + '/' + split[2];
            return {
                datasource: bitbucket_tags_1.BitBucketTagsDatasource.id,
                packageName,
                registryUrl: 'https://bitbucket.org',
            };
        }
        return await BaseGoDatasource.goGetDatasource(goModule);
    }
    static async goGetDatasource(goModule) {
        const pkgUrl = `https://${goModule}?go-get=1`;
        // GitHub Enterprise only returns a go-import meta
        const res = (await BaseGoDatasource.http.get(pkgUrl)).body;
        return (BaseGoDatasource.goSourceHeader(res, goModule) ??
            BaseGoDatasource.goImportHeader(res, goModule));
    }
    static goSourceHeader(res, goModule) {
        const sourceMatch = (0, regex_1.regEx)(`<meta\\s+name="?go-source"?\\s+content="([^\\s]+)\\s+([^\\s]+)`).exec(res);
        if (!sourceMatch) {
            return null;
        }
        const [, prefix, goSourceUrl] = sourceMatch;
        if (!goModule.startsWith(prefix)) {
            logger_1.logger.trace({ goModule }, 'go-source header prefix not match');
            return null;
        }
        logger_1.logger.debug({ goModule, goSourceUrl }, 'Go lookup source url');
        if (goSourceUrl?.startsWith('https://github.com/')) {
            return {
                datasource: github_tags_1.GithubTagsDatasource.id,
                packageName: goSourceUrl
                    .replace('https://github.com/', '')
                    .replace((0, regex_1.regEx)(/\/$/), ''),
                registryUrl: 'https://github.com',
            };
        }
        const gitlabUrl = BaseGoDatasource.gitlabHttpsRegExp.exec(goSourceUrl)?.groups
            ?.httpsRegExpUrl;
        const gitlabUrlName = BaseGoDatasource.gitlabHttpsRegExp.exec(goSourceUrl)?.groups
            ?.httpsRegExpName;
        const gitlabModuleName = BaseGoDatasource.gitlabRegExp.exec(goModule)?.groups?.regExpPath;
        if (gitlabUrl && gitlabUrlName) {
            if (gitlabModuleName?.startsWith(gitlabUrlName)) {
                if (gitlabModuleName.includes('.git')) {
                    return {
                        datasource: gitlab_tags_1.GitlabTagsDatasource.id,
                        registryUrl: gitlabUrl,
                        packageName: gitlabModuleName.substring(0, gitlabModuleName.indexOf('.git')),
                    };
                }
                return {
                    datasource: gitlab_tags_1.GitlabTagsDatasource.id,
                    registryUrl: gitlabUrl,
                    packageName: gitlabModuleName,
                };
            }
            return {
                datasource: gitlab_tags_1.GitlabTagsDatasource.id,
                registryUrl: gitlabUrl,
                packageName: gitlabUrlName,
            };
        }
        const opts = hostRules.find({
            hostType: constants_1.PlatformId.Gitlab,
            url: goSourceUrl,
        });
        if (opts.token) {
            // get server base url from import url
            const parsedUrl = url_1.default.parse(goSourceUrl);
            // TODO: `parsedUrl.pathname` can be undefined
            const packageName = (0, url_2.trimLeadingSlash)(`${parsedUrl.pathname}`);
            const registryUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
            return {
                datasource: gitlab_tags_1.GitlabTagsDatasource.id,
                registryUrl,
                packageName,
            };
        }
        /* istanbul ignore next */
        return null;
    }
    static goImportHeader(res, goModule) {
        const importMatch = (0, regex_1.regEx)(`<meta\\s+name="?go-import"?\\s+content="([^\\s]+)\\s+([^\\s]+)\\s+([^\\s]+)">`).exec(res);
        if (!importMatch) {
            logger_1.logger.trace({ goModule }, 'No go-source or go-import header found');
            return null;
        }
        const [, prefix, , goImportURL] = importMatch;
        if (!goModule.startsWith(prefix)) {
            logger_1.logger.trace({ goModule }, 'go-import header prefix not match');
            return null;
        }
        logger_1.logger.debug({ goModule, goImportURL }, 'Go lookup import url');
        // get server base url from import url
        const parsedUrl = url_1.default.parse(goImportURL);
        // split the go module from the URL: host/go/module -> go/module
        // TODO: `parsedUrl.pathname` can be undefined
        const packageName = (0, url_2.trimTrailingSlash)(`${parsedUrl.pathname}`)
            .replace((0, regex_1.regEx)(/\.git$/), '')
            .split('/')
            .slice(-2)
            .join('/');
        return {
            datasource: github_tags_1.GithubTagsDatasource.id,
            registryUrl: `${parsedUrl.protocol}//${parsedUrl.host}`,
            packageName,
        };
    }
}
exports.BaseGoDatasource = BaseGoDatasource;
BaseGoDatasource.gitlabHttpsRegExp = (0, regex_1.regEx)(/^(?<httpsRegExpUrl>https:\/\/[^/]*gitlab\.[^/]*)\/(?<httpsRegExpName>.+?)(?:\/v\d+)?[/]?$/);
BaseGoDatasource.gitlabRegExp = (0, regex_1.regEx)(/^(?<regExpUrl>gitlab\.[^/]*)\/(?<regExpPath>.+?)(?:\/v\d+)?[/]?$/);
BaseGoDatasource.id = 'go';
BaseGoDatasource.http = new http_1.Http(BaseGoDatasource.id);
//# sourceMappingURL=base.js.map