"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateArtifacts = void 0;
const tslib_1 = require("tslib");
const ruby_semver_1 = require("@renovatebot/ruby-semver");
const shlex_1 = require("shlex");
const error_messages_1 = require("../../../constants/error-messages");
const logger_1 = require("../../../logger");
const memCache = tslib_1.__importStar(require("../../../util/cache/memory"));
const exec_1 = require("../../../util/exec");
const fs_1 = require("../../../util/fs");
const git_1 = require("../../../util/git");
const regex_1 = require("../../../util/regex");
const sanitize_1 = require("../../../util/sanitize");
const ruby_1 = require("../../versioning/ruby");
const common_1 = require("./common");
const host_rules_1 = require("./host-rules");
const hostConfigVariablePrefix = 'BUNDLE_';
function buildBundleHostVariable(hostRule) {
    if (!hostRule.resolvedHost || hostRule.resolvedHost.includes('-')) {
        return {};
    }
    const varName = hostConfigVariablePrefix.concat(hostRule.resolvedHost
        .split('.')
        .map((term) => term.toUpperCase())
        .join('__'));
    return {
        [varName]: `${(0, host_rules_1.getAuthenticationHeaderValue)(hostRule)}`,
    };
}
async function updateArtifacts(updateArtifact) {
    const { packageFileName, updatedDeps, newPackageFileContent, config } = updateArtifact;
    logger_1.logger.debug(`bundler.updateArtifacts(${packageFileName})`);
    const existingError = memCache.get('bundlerArtifactsError');
    // istanbul ignore if
    if (existingError) {
        logger_1.logger.debug('Aborting Bundler artifacts due to previous failed attempt');
        throw new Error(existingError);
    }
    const lockFileName = `${packageFileName}.lock`;
    const existingLockFileContent = await (0, fs_1.readLocalFile)(lockFileName, 'utf8');
    if (!existingLockFileContent) {
        logger_1.logger.debug('No Gemfile.lock found');
        return null;
    }
    try {
        await (0, fs_1.writeLocalFile)(packageFileName, newPackageFileContent);
        let cmd;
        if (config.isLockFileMaintenance) {
            cmd = 'bundler lock --update';
        }
        else {
            cmd = `bundler lock --update ${updatedDeps
                .map((dep) => `${dep.depName}`)
                .filter((dep) => dep !== 'ruby')
                .map(shlex_1.quote)
                .join(' ')}`;
        }
        const bundlerHostRules = (0, host_rules_1.findAllAuthenticatable)({
            hostType: 'rubygems',
        });
        const bundlerHostRulesVariables = bundlerHostRules.reduce((variables, hostRule) => ({
            ...variables,
            ...buildBundleHostVariable(hostRule),
        }), {});
        // Detect hosts with a hyphen '-' in the url.
        // Those cannot be added with environment variables but need to be added
        // with the bundler config
        const bundlerHostRulesAuthCommands = bundlerHostRules.reduce((authCommands, hostRule) => {
            if (hostRule.resolvedHost?.includes('-')) {
                // TODO: fix me, hostrules can missing all auth
                const creds = (0, host_rules_1.getAuthenticationHeaderValue)(hostRule);
                authCommands.push(`${hostRule.resolvedHost} ${creds}`);
                // sanitize the authentication
                (0, sanitize_1.addSecretForSanitizing)(creds);
            }
            return authCommands;
        }, []);
        const bundler = (0, common_1.getBundlerConstraint)(updateArtifact, existingLockFileContent);
        const preCommands = ['ruby --version'];
        // Bundler < 2 has a different config option syntax than >= 2
        if (bundlerHostRulesAuthCommands &&
            bundler &&
            (0, ruby_1.isValid)(bundler) &&
            (0, ruby_semver_1.lt)(bundler, '2')) {
            preCommands.push(...bundlerHostRulesAuthCommands.map((authCommand) => `bundler config --local ${authCommand}`));
        }
        else if (bundlerHostRulesAuthCommands) {
            preCommands.push(...bundlerHostRulesAuthCommands.map((authCommand) => `bundler config set --local ${authCommand}`));
        }
        const execOptions = {
            cwdFile: packageFileName,
            extraEnv: {
                ...bundlerHostRulesVariables,
                GEM_HOME: await (0, fs_1.ensureCacheDir)('bundler'),
            },
            docker: {
                image: 'ruby',
                tagScheme: 'ruby',
                tagConstraint: await (0, common_1.getRubyConstraint)(updateArtifact),
            },
            toolConstraints: [
                {
                    toolName: 'bundler',
                    constraint: bundler,
                },
            ],
            preCommands,
        };
        await (0, exec_1.exec)(cmd, execOptions);
        const status = await (0, git_1.getRepoStatus)();
        if (!status.modified.includes(lockFileName)) {
            return null;
        }
        logger_1.logger.debug('Returning updated Gemfile.lock');
        const lockFileContent = await (0, fs_1.readLocalFile)(lockFileName);
        return [
            {
                file: {
                    type: 'addition',
                    path: lockFileName,
                    contents: lockFileContent,
                },
            },
        ];
    }
    catch (err) /* istanbul ignore next */ {
        if (err.message === error_messages_1.TEMPORARY_ERROR) {
            throw err;
        }
        const output = `${String(err.stdout)}\n${String(err.stderr)}`;
        if (err.message.includes('fatal: Could not parse object') ||
            output.includes('but that version could not be found')) {
            return [
                {
                    artifactError: {
                        lockFile: lockFileName,
                        stderr: output,
                    },
                },
            ];
        }
        if (err.stdout?.includes('Please supply credentials for this source') ||
            err.stderr?.includes('Authentication is required') ||
            err.stderr?.includes('Please make sure you have the correct access rights')) {
            logger_1.logger.debug({ err }, 'Gemfile.lock update failed due to missing credentials - skipping branch');
            // Do not generate these PRs because we don't yet support Bundler authentication
            memCache.set('bundlerArtifactsError', error_messages_1.BUNDLER_INVALID_CREDENTIALS);
            throw new Error(error_messages_1.BUNDLER_INVALID_CREDENTIALS);
        }
        const resolveMatchRe = (0, regex_1.regEx)('\\s+(.*) was resolved to', 'g');
        if (output.match(resolveMatchRe) && !config.isLockFileMaintenance) {
            logger_1.logger.debug({ err }, 'Bundler has a resolve error');
            // TODO: see below
            const resolveMatches = [];
            let resolveMatch;
            do {
                resolveMatch = resolveMatchRe.exec(output);
                if (resolveMatch) {
                    resolveMatches.push(resolveMatch[1].split(' ').shift());
                }
            } while (resolveMatch);
            // TODO: fixme `updatedDeps.includes(match)` is never true, as updatedDeps is `PackageDependency[]`
            if (resolveMatches.some((match) => !updatedDeps.includes(match))) {
                logger_1.logger.debug({ resolveMatches, updatedDeps }, 'Found new resolve matches - reattempting recursively');
                const newUpdatedDeps = [
                    ...new Set([...updatedDeps, ...resolveMatches]),
                ];
                return updateArtifacts({
                    packageFileName,
                    updatedDeps: newUpdatedDeps,
                    newPackageFileContent,
                    config,
                });
            }
            logger_1.logger.debug({ err }, 'Gemfile.lock update failed due to incompatible packages');
        }
        else {
            logger_1.logger.info({ err }, 'Gemfile.lock update failed due to an unknown reason');
        }
        return [
            {
                artifactError: {
                    lockFile: lockFileName,
                    stderr: `${String(err.stdout)}\n${String(err.stderr)}`,
                },
            },
        ];
    }
}
exports.updateArtifacts = updateArtifacts;
//# sourceMappingURL=artifacts.js.map