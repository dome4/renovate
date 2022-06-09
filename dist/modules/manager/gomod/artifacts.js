"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateArtifacts = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const upath_1 = tslib_1.__importDefault(require("upath"));
const global_1 = require("../../../config/global");
const constants_1 = require("../../../constants");
const error_messages_1 = require("../../../constants/error-messages");
const logger_1 = require("../../../logger");
const exec_1 = require("../../../util/exec");
const fs_1 = require("../../../util/fs");
const git_1 = require("../../../util/git");
const auth_1 = require("../../../util/git/auth");
const host_rules_1 = require("../../../util/host-rules");
const regex_1 = require("../../../util/regex");
const url_1 = require("../../../util/url");
const semver_1 = require("../../versioning/semver");
function getGitEnvironmentVariables() {
    let environmentVariables = {};
    // hard-coded logic to use authentication for github.com based on the githubToken for api.github.com
    const githubToken = (0, host_rules_1.find)({
        hostType: constants_1.PlatformId.Github,
        url: 'https://api.github.com/',
    });
    if (githubToken?.token) {
        environmentVariables = (0, auth_1.getGitAuthenticatedEnvironmentVariables)('https://github.com/', githubToken);
    }
    // get extra host rules for other git-based Go Module hosts
    const hostRules = (0, host_rules_1.getAll)() || [];
    const goGitAllowedHostType = [
        // All known git platforms
        constants_1.PlatformId.Azure,
        constants_1.PlatformId.Bitbucket,
        constants_1.PlatformId.BitbucketServer,
        constants_1.PlatformId.Gitea,
        constants_1.PlatformId.Github,
        constants_1.PlatformId.Gitlab,
        // plus all without a host type (=== undefined)
        undefined,
    ];
    // for each hostRule we add additional authentication variables to the environmentVariables
    for (const hostRule of hostRules) {
        if (hostRule?.token &&
            hostRule.matchHost &&
            goGitAllowedHostType.includes(hostRule.hostType)) {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            const httpUrl = (0, url_1.createURLFromHostOrURL)(hostRule.matchHost)?.toString();
            if ((0, url_1.validateUrl)(httpUrl)) {
                logger_1.logger.debug(`Adding Git authentication for Go Module retrieval for ${httpUrl} using token auth.`);
                environmentVariables = (0, auth_1.getGitAuthenticatedEnvironmentVariables)(
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                httpUrl, hostRule, environmentVariables);
            }
            else {
                logger_1.logger.warn(`Could not parse registryUrl ${hostRule.matchHost} or not using http(s). Ignoring`);
            }
        }
    }
    return environmentVariables;
}
function getUpdateImportPathCmds(updatedDeps, { constraints, newMajor }) {
    const updateImportCommands = updatedDeps
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        .map((dep) => dep.depName)
        .filter((x) => !x.startsWith('gopkg.in'))
        .map((depName) => `mod upgrade --mod-name=${depName} -t=${newMajor}`);
    if (updateImportCommands.length > 0) {
        let installMarwanModArgs = 'install github.com/marwan-at-work/mod/cmd/mod@latest';
        const gomodModCompatibility = constraints?.gomodMod;
        if (gomodModCompatibility) {
            if (gomodModCompatibility.startsWith('v') &&
                (0, semver_1.isValid)(gomodModCompatibility.replace((0, regex_1.regEx)(/^v/), ''))) {
                installMarwanModArgs = installMarwanModArgs.replace((0, regex_1.regEx)(/@latest$/), `@${gomodModCompatibility}`);
            }
            else {
                logger_1.logger.debug({ gomodModCompatibility }, 'marwan-at-work/mod compatibility range is not valid - skipping');
            }
        }
        else {
            logger_1.logger.debug('No marwan-at-work/mod compatibility range found - installing marwan-at-work/mod latest');
        }
        updateImportCommands.unshift(`go ${installMarwanModArgs}`);
    }
    return updateImportCommands;
}
function useModcacherw(goVersion) {
    if (!is_1.default.string(goVersion)) {
        return true;
    }
    const [, majorPart, minorPart] = (0, regex_1.regEx)(/(\d+)\.(\d+)/).exec(goVersion) ?? [];
    const [major, minor] = [majorPart, minorPart].map((x) => parseInt(x, 10));
    return (!Number.isNaN(major) &&
        !Number.isNaN(minor) &&
        (major > 1 || (major === 1 && minor >= 14)));
}
async function updateArtifacts({ packageFileName: goModFileName, updatedDeps, newPackageFileContent: newGoModContent, config, }) {
    logger_1.logger.debug(`gomod.updateArtifacts(${goModFileName})`);
    const sumFileName = goModFileName.replace((0, regex_1.regEx)(/\.mod$/), '.sum');
    const existingGoSumContent = await (0, fs_1.readLocalFile)(sumFileName);
    if (!existingGoSumContent) {
        logger_1.logger.debug('No go.sum found');
        return null;
    }
    const vendorDir = upath_1.default.join(upath_1.default.dirname(goModFileName), 'vendor/');
    const vendorModulesFileName = upath_1.default.join(vendorDir, 'modules.txt');
    const useVendor = (await (0, fs_1.readLocalFile)(vendorModulesFileName)) !== null;
    let massagedGoMod = newGoModContent;
    if (config.postUpdateOptions?.includes('gomodMassage')) {
        // Regex match inline replace directive, example:
        // replace golang.org/x/net v1.2.3 => example.com/fork/net v1.4.5
        // https://go.dev/ref/mod#go-mod-file-replace
        // replace bracket after comments, so it doesn't break the regex, doing a complex regex causes problems
        // when there's a comment and ")" after it, the regex will read replace block until comment.. and stop.
        massagedGoMod = massagedGoMod
            .split('\n')
            .map((line) => {
            if (line.trim().startsWith('//')) {
                return line.replace(')', 'renovate-replace-bracket');
            }
            return line;
        })
            .join('\n');
        const inlineReplaceRegEx = (0, regex_1.regEx)(/(\r?\n)(replace\s+[^\s]+\s+=>\s+\.\.\/.*)/g);
        // $1 will be matched with the (\r?n) group
        // $2 will be matched with the inline replace match, example
        // "// renovate-replace replace golang.org/x/net v1.2.3 => example.com/fork/net v1.4.5"
        const inlineCommentOut = '$1// renovate-replace $2';
        // Regex match replace directive block, example:
        // replace (
        //     golang.org/x/net v1.2.3 => example.com/fork/net v1.4.5
        // )
        const blockReplaceRegEx = (0, regex_1.regEx)(/(\r?\n)replace\s*\([^)]+\s*\)/g);
        /**
         * replacerFunction for commenting out replace blocks
         * @param match A string representing a golang replace directive block
         * @returns A commented out block with // renovate-replace
         */
        const blockCommentOut = (match) => match.replace(/(\r?\n)/g, '$1// renovate-replace ');
        // Comment out golang replace directives
        massagedGoMod = massagedGoMod
            .replace(inlineReplaceRegEx, inlineCommentOut)
            .replace(blockReplaceRegEx, blockCommentOut);
        if (massagedGoMod !== newGoModContent) {
            logger_1.logger.debug('Removed some relative replace statements and comments from go.mod');
        }
    }
    try {
        await (0, fs_1.writeLocalFile)(goModFileName, massagedGoMod);
        const cmd = 'go';
        const execOptions = {
            cwdFile: goModFileName,
            extraEnv: {
                GOPATH: await (0, fs_1.ensureCacheDir)('go'),
                GOPROXY: process.env.GOPROXY,
                GOPRIVATE: process.env.GOPRIVATE,
                GONOPROXY: process.env.GONOPROXY,
                GONOSUMDB: process.env.GONOSUMDB,
                GOSUMDB: process.env.GOSUMDB,
                GOFLAGS: useModcacherw(config.constraints?.go) ? '-modcacherw' : null,
                CGO_ENABLED: global_1.GlobalConfig.get('binarySource') === 'docker' ? '0' : null,
                ...getGitEnvironmentVariables(),
            },
            docker: {
                image: 'go',
                tagConstraint: config.constraints?.go,
                tagScheme: 'npm',
            },
        };
        const execCommands = [];
        let args = 'get -d -t ./...';
        logger_1.logger.debug({ cmd, args }, 'go get command included');
        execCommands.push(`${cmd} ${args}`);
        // Update import paths on major updates above v1
        const isImportPathUpdateRequired = config.postUpdateOptions?.includes('gomodUpdateImportPaths') &&
            config.updateType === 'major' &&
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            config.newMajor > 1;
        if (isImportPathUpdateRequired) {
            const updateImportCmds = getUpdateImportPathCmds(updatedDeps, config);
            if (updateImportCmds.length > 0) {
                logger_1.logger.debug(updateImportCmds, 'update import path commands included');
                // The updates
                execCommands.push(...updateImportCmds);
            }
        }
        const mustSkipGoModTidy = !config.postUpdateOptions?.includes('gomodUpdateImportPaths') &&
            config.updateType === 'major';
        if (mustSkipGoModTidy) {
            logger_1.logger.debug({ cmd, args }, 'go mod tidy command skipped');
        }
        const tidyOpts = config.postUpdateOptions?.includes('gomodTidy1.17')
            ? ' -compat=1.17'
            : '';
        const isGoModTidyRequired = !mustSkipGoModTidy &&
            (config.postUpdateOptions?.includes('gomodTidy') ||
                config.postUpdateOptions?.includes('gomodTidy1.17') ||
                (config.updateType === 'major' && isImportPathUpdateRequired));
        if (isGoModTidyRequired) {
            args = 'mod tidy' + tidyOpts;
            logger_1.logger.debug({ cmd, args }, 'go mod tidy command included');
            execCommands.push(`${cmd} ${args}`);
        }
        if (useVendor) {
            args = 'mod vendor';
            logger_1.logger.debug({ cmd, args }, 'go mod vendor command included');
            execCommands.push(`${cmd} ${args}`);
            if (isGoModTidyRequired) {
                args = 'mod tidy' + tidyOpts;
                logger_1.logger.debug({ cmd, args }, 'go mod tidy command included');
                execCommands.push(`${cmd} ${args}`);
            }
        }
        // We tidy one more time as a solution for #6795
        if (isGoModTidyRequired) {
            args = 'mod tidy' + tidyOpts;
            logger_1.logger.debug({ cmd, args }, 'additional go mod tidy command included');
            execCommands.push(`${cmd} ${args}`);
        }
        await (0, exec_1.exec)(execCommands, execOptions);
        const status = await (0, git_1.getRepoStatus)();
        if (!status.modified.includes(sumFileName)) {
            return null;
        }
        logger_1.logger.debug('Returning updated go.sum');
        const res = [
            {
                file: {
                    type: 'addition',
                    path: sumFileName,
                    contents: await (0, fs_1.readLocalFile)(sumFileName),
                },
            },
        ];
        // Include all the .go file import changes
        if (isImportPathUpdateRequired) {
            logger_1.logger.debug('Returning updated go source files for import path changes');
            for (const f of status.modified) {
                if (f.endsWith('.go')) {
                    res.push({
                        file: {
                            type: 'addition',
                            path: f,
                            contents: await (0, fs_1.readLocalFile)(f),
                        },
                    });
                }
            }
        }
        if (useVendor) {
            for (const f of status.modified.concat(status.not_added)) {
                if (f.startsWith(vendorDir)) {
                    res.push({
                        file: {
                            type: 'addition',
                            path: f,
                            contents: await (0, fs_1.readLocalFile)(f),
                        },
                    });
                }
            }
            for (const f of status.deleted || []) {
                res.push({
                    file: {
                        type: 'deletion',
                        path: f,
                    },
                });
            }
        }
        const finalGoModContent = (await (0, fs_1.readLocalFile)(goModFileName, 'utf8'))
            .replace((0, regex_1.regEx)(/\/\/ renovate-replace /g), '')
            .replace((0, regex_1.regEx)(/renovate-replace-bracket/g), ')');
        if (finalGoModContent !== newGoModContent) {
            logger_1.logger.debug('Found updated go.mod after go.sum update');
            res.push({
                file: {
                    type: 'addition',
                    path: goModFileName,
                    contents: finalGoModContent,
                },
            });
        }
        return res;
    }
    catch (err) {
        // istanbul ignore if
        if (err.message === error_messages_1.TEMPORARY_ERROR) {
            throw err;
        }
        logger_1.logger.debug({ err }, 'Failed to update go.sum');
        return [
            {
                artifactError: {
                    lockFile: sumFileName,
                    stderr: err.message,
                },
            },
        ];
    }
}
exports.updateArtifacts = updateArtifacts;
//# sourceMappingURL=artifacts.js.map