"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPackageFile = exports.cleanRegistryUrls = exports.dependencyPattern = exports.packagePattern = void 0;
const tslib_1 = require("tslib");
// based on https://www.python.org/dev/peps/pep-0508/#names
const pep440_1 = require("@renovatebot/pep440");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const global_1 = require("../../../config/global");
const logger_1 = require("../../../logger");
const ignore_1 = require("../../../util/ignore");
const regex_1 = require("../../../util/regex");
const git_tags_1 = require("../../datasource/git-tags");
const pypi_1 = require("../../datasource/pypi");
exports.packagePattern = '[a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]';
const extrasPattern = '(?:\\s*\\[[^\\]]+\\])?';
const packageGitRegex = (0, regex_1.regEx)(/(?<source>(?:git\+)(?<protocol>git|ssh|https):\/\/(?<gitUrl>(?:(?<user>[^@]+)@)?(?<hostname>[\w.-]+)(?<delimiter>\/)(?<scmPath>.*\/(?<depName>[\w/-]+))(\.git)?(?:@(?<version>.*))))/);
const rangePattern = pep440_1.RANGE_PATTERN;
const specifierPartPattern = `\\s*${rangePattern.replace((0, regex_1.regEx)(/\?<\w+>/g), '?:')}`;
const specifierPattern = `${specifierPartPattern}(?:\\s*,${specifierPartPattern})*`;
exports.dependencyPattern = `(${exports.packagePattern})(${extrasPattern})(${specifierPattern})`;
function cleanRegistryUrls(registryUrls) {
    return registryUrls.map((url) => {
        // handle the optional quotes in eg. `--extra-index-url "https://foo.bar"`
        const cleaned = url.replace((0, regex_1.regEx)(/^"/), '').replace((0, regex_1.regEx)(/"$/), '');
        if (!global_1.GlobalConfig.get('exposeAllEnv')) {
            return cleaned;
        }
        // interpolate any environment variables
        return cleaned.replace((0, regex_1.regEx)(/(\$[A-Za-z\d_]+)|(\${[A-Za-z\d_]+})/g), (match) => {
            const envvar = match
                .substring(1)
                .replace((0, regex_1.regEx)(/^{/), '')
                .replace((0, regex_1.regEx)(/}$/), '');
            const sub = process.env[envvar];
            return sub || match;
        });
    });
}
exports.cleanRegistryUrls = cleanRegistryUrls;
function extractPackageFile(content) {
    logger_1.logger.trace('pip_requirements.extractPackageFile()');
    let registryUrls = [];
    const additionalRegistryUrls = [];
    content.split(regex_1.newlineRegex).forEach((line) => {
        if (line.startsWith('--index-url ')) {
            registryUrls = [line.substring('--index-url '.length).split(' ')[0]];
        }
        if (line.startsWith('--extra-index-url ')) {
            const extraUrl = line
                .substring('--extra-index-url '.length)
                .split(' ')[0];
            additionalRegistryUrls.push(extraUrl);
        }
    });
    const pkgRegex = (0, regex_1.regEx)(`^(${exports.packagePattern})$`);
    const pkgValRegex = (0, regex_1.regEx)(`^${exports.dependencyPattern}$`);
    const deps = content
        .split(regex_1.newlineRegex)
        .map((rawline) => {
        let dep = {};
        const [line, comment] = rawline.split('#').map((part) => part.trim());
        if ((0, ignore_1.isSkipComment)(comment)) {
            dep.skipReason = 'ignored';
        }
        const [lineNoEnvMarkers] = line.split(';').map((part) => part.trim());
        const lineNoHashes = lineNoEnvMarkers.split(' \\')[0];
        const packageMatches = pkgValRegex.exec(lineNoHashes) || pkgRegex.exec(lineNoHashes);
        const gitPackageMatches = packageGitRegex.exec(lineNoHashes);
        if (!packageMatches && !gitPackageMatches) {
            return null;
        }
        if (gitPackageMatches?.groups) {
            const currentVersion = gitPackageMatches.groups.version;
            const depName = gitPackageMatches.groups.depName;
            let packageName;
            if (gitPackageMatches.groups.protocol === 'https') {
                packageName = 'https://'
                    .concat(gitPackageMatches.groups.gitUrl)
                    .replace(`@${currentVersion}`, '');
            }
            else {
                // we need to replace the / with a :
                const scmPath = gitPackageMatches.groups.scmPath;
                const delimiter = gitPackageMatches.groups.delimiter;
                packageName = gitPackageMatches.groups.gitUrl
                    .replace(`${delimiter}${scmPath}`, `:${scmPath}`)
                    .replace(`@${currentVersion}`, '');
            }
            dep = {
                ...dep,
                depName,
                currentValue: currentVersion,
                currentVersion,
                packageName,
                datasource: git_tags_1.GitTagsDatasource.id,
            };
            return dep;
        }
        // validated above
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        const [, depName, , currVal] = packageMatches;
        const currentValue = currVal?.trim();
        dep = {
            ...dep,
            depName,
            currentValue,
            datasource: pypi_1.PypiDatasource.id,
        };
        if (currentValue?.startsWith('==')) {
            dep.currentVersion = currentValue.replace(/^==\s*/, '');
        }
        return dep;
    })
        .filter(is_1.default.truthy);
    if (!deps.length) {
        return null;
    }
    const res = { deps };
    if (registryUrls.length > 0) {
        res.registryUrls = cleanRegistryUrls(registryUrls);
    }
    if (additionalRegistryUrls.length) {
        res.additionalRegistryUrls = cleanRegistryUrls(additionalRegistryUrls);
    }
    return res;
}
exports.extractPackageFile = extractPackageFile;
//# sourceMappingURL=extract.js.map