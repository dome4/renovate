"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateLockFiles = exports.getLernaVersion = void 0;
const tslib_1 = require("tslib");
const semver_1 = tslib_1.__importDefault(require("semver"));
const shlex_1 = require("shlex");
const upath_1 = tslib_1.__importDefault(require("upath"));
const global_1 = require("../../../../config/global");
const error_messages_1 = require("../../../../constants/error-messages");
const logger_1 = require("../../../../logger");
const exec_1 = require("../../../../util/exec");
const node_version_1 = require("./node-version");
const yarn_1 = require("./yarn");
// Exported for testability
function getLernaVersion(lernaPackageFile) {
    const lernaDep = lernaPackageFile.deps?.find((d) => d.depName === 'lerna');
    if (!lernaDep || !semver_1.default.validRange(lernaDep.currentValue)) {
        logger_1.logger.warn(`Could not detect lerna version in ${lernaPackageFile.packageFile}, using 'latest'`);
        return 'latest';
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    return lernaDep.currentValue;
}
exports.getLernaVersion = getLernaVersion;
async function generateLockFiles(lernaPackageFile, lockFileDir, config, env, skipInstalls) {
    const lernaClient = lernaPackageFile.lernaClient;
    if (!lernaClient) {
        logger_1.logger.warn('No lernaClient specified - returning');
        return { error: false };
    }
    logger_1.logger.debug(`Spawning lerna with ${lernaClient} to create lock files`);
    const preCommands = [];
    const cmd = [];
    let cmdOptions = '';
    try {
        if (lernaClient === 'yarn') {
            let installYarn = 'npm i -g yarn';
            const yarnCompatibility = config.constraints?.yarn;
            if (semver_1.default.validRange(yarnCompatibility)) {
                installYarn += `@${(0, shlex_1.quote)(yarnCompatibility)}`;
            }
            preCommands.push(installYarn);
            if (skipInstalls !== false) {
                preCommands.push((0, yarn_1.getOptimizeCommand)());
            }
            cmdOptions = '--ignore-scripts --ignore-engines --ignore-platform';
        }
        else if (lernaClient === 'npm') {
            let installNpm = 'npm i -g npm';
            const npmCompatibility = config.constraints?.npm;
            if (semver_1.default.validRange(npmCompatibility)) {
                installNpm += `@${(0, shlex_1.quote)(npmCompatibility)} || true`;
            }
            preCommands.push(installNpm, 'hash -d npm 2>/dev/null || true');
            cmdOptions = '--ignore-scripts  --no-audit';
            if (skipInstalls !== false) {
                cmdOptions += ' --package-lock-only';
            }
        }
        else {
            logger_1.logger.warn({ lernaClient }, 'Unknown lernaClient');
            return { error: false };
        }
        let lernaCommand = `lerna bootstrap --no-ci --ignore-scripts -- `;
        if (global_1.GlobalConfig.get('allowScripts') && config.ignoreScripts !== false) {
            cmdOptions = cmdOptions.replace('--ignore-scripts ', '');
            lernaCommand = lernaCommand.replace('--ignore-scripts ', '');
        }
        lernaCommand += cmdOptions;
        const tagConstraint = await (0, node_version_1.getNodeConstraint)(config);
        const extraEnv = {
            NPM_CONFIG_CACHE: env.NPM_CONFIG_CACHE,
            npm_config_store: env.npm_config_store,
        };
        const execOptions = {
            cwdFile: upath_1.default.join(lockFileDir, 'package.json'),
            extraEnv,
            docker: {
                image: 'node',
                tagScheme: 'node',
                tagConstraint,
            },
            preCommands,
        };
        // istanbul ignore if
        if (global_1.GlobalConfig.get('exposeAllEnv')) {
            extraEnv.NPM_AUTH = env.NPM_AUTH;
            extraEnv.NPM_EMAIL = env.NPM_EMAIL;
        }
        const lernaVersion = getLernaVersion(lernaPackageFile);
        logger_1.logger.debug('Using lerna version ' + lernaVersion);
        preCommands.push(`npm i -g lerna@${(0, shlex_1.quote)(lernaVersion)}`);
        cmd.push('lerna info || echo "Ignoring lerna info failure"');
        cmd.push(`${lernaClient} install ${cmdOptions}`);
        cmd.push(lernaCommand);
        await (0, exec_1.exec)(cmd, execOptions);
    }
    catch (err) /* istanbul ignore next */ {
        if (err.message === error_messages_1.TEMPORARY_ERROR) {
            throw err;
        }
        logger_1.logger.debug({
            cmd,
            err,
            type: 'lerna',
            lernaClient,
        }, 'lock file error');
        return { error: true, stderr: err.stderr };
    }
    return { error: false };
}
exports.generateLockFiles = generateLockFiles;
//# sourceMappingURL=lerna.js.map