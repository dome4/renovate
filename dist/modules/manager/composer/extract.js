"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPackageFile = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const logger_1 = require("../../../logger");
const fs_1 = require("../../../util/fs");
const regex_1 = require("../../../util/regex");
const git_tags_1 = require("../../datasource/git-tags");
const packagist_1 = require("../../datasource/packagist");
const composer_1 = require("../../versioning/composer");
/**
 * The regUrl is expected to be a base URL. GitLab composer repository installation guide specifies
 * to use a base URL containing packages.json. Composer still works in this scenario by determining
 * whether to add / remove packages.json from the URL.
 *
 * See https://github.com/composer/composer/blob/750a92b4b7aecda0e5b2f9b963f1cb1421900675/src/Composer/Repository/ComposerRepository.php#L815
 */
function transformRegUrl(url) {
    return url.replace((0, regex_1.regEx)(/(\/packages\.json)$/), '');
}
/**
 * Parse the repositories field from a composer.json
 *
 * Entries with type vcs or git will be added to repositories,
 * other entries will be added to registryUrls
 */
function parseRepositories(repoJson, repositories, registryUrls) {
    try {
        let packagist = true;
        Object.entries(repoJson).forEach(([key, repo]) => {
            if (is_1.default.object(repo)) {
                const name = is_1.default.array(repoJson) ? repo.name : key;
                switch (repo.type) {
                    case 'vcs':
                    case 'git':
                        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                        repositories[name] = repo;
                        break;
                    case 'composer':
                        registryUrls.push(transformRegUrl(repo.url));
                        break;
                    case 'package':
                        logger_1.logger.debug({ url: repo.url }, 'type package is not supported yet');
                }
                if (repo.packagist === false || repo['packagist.org'] === false) {
                    packagist = false;
                }
            } // istanbul ignore else: invalid repo
            else if (['packagist', 'packagist.org'].includes(key) && repo === false) {
                packagist = false;
            }
        });
        if (packagist) {
            registryUrls.push('https://packagist.org');
        }
        else {
            logger_1.logger.debug('Disabling packagist.org');
        }
    }
    catch (e) /* istanbul ignore next */ {
        logger_1.logger.debug({ repositories: repoJson }, 'Error parsing composer.json repositories config');
    }
}
async function extractPackageFile(content, fileName) {
    logger_1.logger.trace(`composer.extractPackageFile(${fileName})`);
    let composerJson;
    try {
        composerJson = JSON.parse(content);
    }
    catch (err) {
        logger_1.logger.debug({ fileName }, 'Invalid JSON');
        return null;
    }
    const repositories = {};
    const registryUrls = [];
    const res = { deps: [] };
    // handle lockfile
    const lockfilePath = fileName.replace((0, regex_1.regEx)(/\.json$/), '.lock');
    const lockContents = await (0, fs_1.readLocalFile)(lockfilePath, 'utf8');
    let lockParsed;
    if (lockContents) {
        logger_1.logger.debug({ packageFile: fileName }, 'Found composer lock file');
        res.lockFiles = [lockfilePath];
        try {
            lockParsed = JSON.parse(lockContents);
        }
        catch (err) /* istanbul ignore next */ {
            logger_1.logger.warn({ err }, 'Error processing composer.lock');
        }
    }
    // handle composer.json repositories
    if (composerJson.repositories) {
        parseRepositories(composerJson.repositories, repositories, registryUrls);
    }
    if (registryUrls.length !== 0) {
        res.registryUrls = registryUrls;
    }
    const deps = [];
    const depTypes = ['require', 'require-dev'];
    for (const depType of depTypes) {
        if (composerJson[depType]) {
            try {
                for (const [depName, version] of Object.entries(composerJson[depType])) {
                    const currentValue = version.trim();
                    // Default datasource and packageName
                    let datasource = packagist_1.PackagistDatasource.id;
                    let packageName = depName;
                    // Check custom repositories by type
                    if (repositories[depName]) {
                        switch (repositories[depName].type) {
                            case 'vcs':
                            case 'git':
                                datasource = git_tags_1.GitTagsDatasource.id;
                                packageName = repositories[depName].url;
                                break;
                        }
                    }
                    const dep = {
                        depType,
                        depName,
                        currentValue,
                        datasource,
                    };
                    if (depName !== packageName) {
                        dep.packageName = packageName;
                    }
                    if (!depName.includes('/')) {
                        dep.skipReason = 'unsupported';
                    }
                    if (lockParsed) {
                        const lockField = depType === 'require'
                            ? 'packages'
                            : /* istanbul ignore next */ 'packages-dev';
                        const lockedDep = lockParsed[lockField]?.find((item) => item.name === dep.depName);
                        if (lockedDep && composer_1.api.isVersion(lockedDep.version)) {
                            dep.lockedVersion = lockedDep.version.replace((0, regex_1.regEx)(/^v/i), '');
                        }
                    }
                    deps.push(dep);
                }
            }
            catch (err) /* istanbul ignore next */ {
                logger_1.logger.debug({ fileName, depType, err }, 'Error parsing composer.json');
                return null;
            }
        }
    }
    if (!deps.length) {
        return null;
    }
    res.deps = deps;
    if (is_1.default.string(composerJson.type)) {
        const managerData = {
            composerJsonType: composerJson.type,
        };
        res.managerData = managerData;
    }
    return res;
}
exports.extractPackageFile = extractPackageFile;
//# sourceMappingURL=extract.js.map