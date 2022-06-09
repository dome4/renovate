"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCommitTree = exports.clearRenovateRefs = exports.pushCommitToRenovateRef = exports.getUrl = exports.commitFiles = exports.fetchCommit = exports.pushCommit = exports.prepareCommit = exports.hasDiff = exports.getFile = exports.getBranchFiles = exports.getBranchLastCommitTime = exports.mergeBranch = exports.deleteBranch = exports.isBranchConflicted = exports.isBranchModified = exports.isBranchStale = exports.getBranchList = exports.getFileList = exports.checkoutBranch = exports.getCommitMessages = exports.getBranchParentSha = exports.getBranchCommit = exports.branchExists = exports.getRepoStatus = exports.syncGit = exports.getSubmodules = exports.setUserRepoConfig = exports.writeGitAuthor = exports.setGitAuthor = exports.initRepo = exports.validateGitVersion = exports.GIT_MINIMUM_VERSION = exports.gitRetry = exports.setPrivateKey = exports.setNoVerify = void 0;
const tslib_1 = require("tslib");
const url_1 = tslib_1.__importDefault(require("url"));
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const delay_1 = tslib_1.__importDefault(require("delay"));
const fs_extra_1 = tslib_1.__importDefault(require("fs-extra"));
const simple_git_1 = tslib_1.__importStar(require("simple-git"));
const upath_1 = tslib_1.__importDefault(require("upath"));
const app_strings_1 = require("../../config/app-strings");
const global_1 = require("../../config/global");
const error_messages_1 = require("../../constants/error-messages");
const logger_1 = require("../../logger");
const semver_coerced_1 = require("../../modules/versioning/semver-coerced");
const external_host_error_1 = require("../../types/errors/external-host-error");
const limits_1 = require("../../workers/global/limits");
const regex_1 = require("../regex");
const author_1 = require("./author");
const config_1 = require("./config");
const conflicts_cache_1 = require("./conflicts-cache");
const error_1 = require("./error");
const private_key_1 = require("./private-key");
var config_2 = require("./config");
Object.defineProperty(exports, "setNoVerify", { enumerable: true, get: function () { return config_2.setNoVerify; } });
var private_key_2 = require("./private-key");
Object.defineProperty(exports, "setPrivateKey", { enumerable: true, get: function () { return private_key_2.setPrivateKey; } });
// Retry parameters
const retryCount = 5;
const delaySeconds = 3;
const delayFactor = 2;
// A generic wrapper for simpleGit.* calls to make them more fault-tolerant
async function gitRetry(gitFunc) {
    let round = 0;
    let lastError;
    while (round <= retryCount) {
        if (round > 0) {
            logger_1.logger.debug(`gitRetry round ${round}`);
        }
        try {
            const res = await gitFunc();
            if (round > 1) {
                logger_1.logger.debug('Successful retry of git function');
            }
            return res;
        }
        catch (err) {
            lastError = err;
            logger_1.logger.debug({ err }, `Git function thrown`);
            // Try to transform the Error to ExternalHostError
            const errChecked = (0, error_1.checkForPlatformFailure)(err);
            if (errChecked instanceof external_host_error_1.ExternalHostError) {
                logger_1.logger.debug({ err: errChecked }, `ExternalHostError thrown in round ${round + 1} of ${retryCount} - retrying in the next round`);
            }
            else {
                throw err;
            }
        }
        const nextDelay = delayFactor ^ ((round - 1) * delaySeconds);
        logger_1.logger.trace({ nextDelay }, `Delay next round`);
        await (0, delay_1.default)(1000 * nextDelay);
        round++;
    }
    throw lastError;
}
exports.gitRetry = gitRetry;
function localName(branchName) {
    return branchName.replace((0, regex_1.regEx)(/^origin\//), '');
}
async function isDirectory(dir) {
    try {
        return (await fs_extra_1.default.stat(dir)).isDirectory();
    }
    catch (err) {
        return false;
    }
}
async function getDefaultBranch(git) {
    // see https://stackoverflow.com/a/62352647/3005034
    try {
        let res = await git.raw(['rev-parse', '--abbrev-ref', 'origin/HEAD']);
        // istanbul ignore if
        if (!res) {
            logger_1.logger.debug('Could not determine default branch using git rev-parse');
            const headPrefix = 'HEAD branch: ';
            res = (await git.raw(['remote', 'show', 'origin']))
                .split('\n')
                .map((line) => line.trim())
                .find((line) => line.startsWith(headPrefix))
                .replace(headPrefix, '');
        }
        return res.replace('origin/', '').trim();
    }
    catch (err) /* istanbul ignore next */ {
        const errChecked = (0, error_1.checkForPlatformFailure)(err);
        if (errChecked) {
            throw errChecked;
        }
        if (err.message.startsWith('fatal: ref refs/remotes/origin/HEAD is not a symbolic ref')) {
            throw new Error(error_messages_1.REPOSITORY_EMPTY);
        }
        // istanbul ignore if
        if (err.message.includes("fatal: ambiguous argument 'origin/HEAD'")) {
            logger_1.logger.warn({ err }, 'Error getting default branch');
            throw new Error(error_messages_1.TEMPORARY_ERROR);
        }
        throw err;
    }
}
let config = {};
// TODO: can be undefined
let git;
let gitInitialized;
let privateKeySet = false;
exports.GIT_MINIMUM_VERSION = '2.33.0'; // git show-current
async function validateGitVersion() {
    let version;
    const globalGit = (0, simple_git_1.default)();
    try {
        const raw = await globalGit.raw(['--version']);
        for (const section of raw.split(/\s+/)) {
            if (semver_coerced_1.api.isVersion(section)) {
                version = section;
                break;
            }
        }
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.error({ err }, 'Error fetching git version');
        return false;
    }
    // istanbul ignore if
    if (!(version &&
        (semver_coerced_1.api.equals(version, exports.GIT_MINIMUM_VERSION) ||
            semver_coerced_1.api.isGreaterThan(version, exports.GIT_MINIMUM_VERSION)))) {
        logger_1.logger.error({ detectedVersion: version, minimumVersion: exports.GIT_MINIMUM_VERSION }, 'Git version needs upgrading');
        return false;
    }
    logger_1.logger.debug(`Found valid git version: ${version}`);
    return true;
}
exports.validateGitVersion = validateGitVersion;
async function fetchBranchCommits() {
    config.branchCommits = {};
    const opts = ['ls-remote', '--heads', config.url];
    if (config.extraCloneOpts) {
        Object.entries(config.extraCloneOpts).forEach((e) => opts.unshift(e[0], `${e[1]}`));
    }
    try {
        (await gitRetry(() => git.raw(opts)))
            .split(regex_1.newlineRegex)
            .filter(Boolean)
            .map((line) => line.trim().split((0, regex_1.regEx)(/\s+/)))
            .forEach(([sha, ref]) => {
            config.branchCommits[ref.replace('refs/heads/', '')] = sha;
        });
    }
    catch (err) /* istanbul ignore next */ {
        const errChecked = (0, error_1.checkForPlatformFailure)(err);
        if (errChecked) {
            throw errChecked;
        }
        logger_1.logger.debug({ err }, 'git error');
        if (err.message?.includes('Please ask the owner to check their account')) {
            throw new Error(error_messages_1.REPOSITORY_DISABLED);
        }
        throw err;
    }
}
async function initRepo(args) {
    config = { ...args };
    config.ignoredAuthors = [];
    config.additionalBranches = [];
    config.branchIsModified = {};
    const { localDir } = global_1.GlobalConfig.get();
    git = (0, simple_git_1.default)(localDir, (0, config_1.simpleGitConfig)());
    gitInitialized = false;
    await fetchBranchCommits();
}
exports.initRepo = initRepo;
async function resetToBranch(branchName) {
    logger_1.logger.debug(`resetToBranch(${branchName})`);
    await git.raw(['reset', '--hard']);
    await gitRetry(() => git.checkout(branchName));
    await git.raw(['reset', '--hard', 'origin/' + branchName]);
    await git.raw(['clean', '-fd']);
}
async function deleteLocalBranch(branchName) {
    await git.branch(['-D', branchName]);
}
async function cleanLocalBranches() {
    const existingBranches = (await git.raw(['branch']))
        .split(regex_1.newlineRegex)
        .map((branch) => branch.trim())
        .filter((branch) => branch.length)
        .filter((branch) => !branch.startsWith('* '));
    logger_1.logger.debug({ existingBranches });
    for (const branchName of existingBranches) {
        await deleteLocalBranch(branchName);
    }
}
function setGitAuthor(gitAuthor) {
    const gitAuthorParsed = (0, author_1.parseGitAuthor)(gitAuthor || 'Renovate Bot <renovate@whitesourcesoftware.com>');
    if (!gitAuthorParsed) {
        const error = new Error(error_messages_1.CONFIG_VALIDATION);
        error.validationSource = 'None';
        error.validationError = 'Invalid gitAuthor';
        error.validationMessage = `gitAuthor is not parsed as valid RFC5322 format: ${gitAuthor}`;
        throw error;
    }
    config.gitAuthorName = gitAuthorParsed.name;
    config.gitAuthorEmail = gitAuthorParsed.address;
}
exports.setGitAuthor = setGitAuthor;
async function writeGitAuthor() {
    const { gitAuthorName, gitAuthorEmail, writeGitDone } = config;
    // istanbul ignore if
    if (writeGitDone) {
        return;
    }
    config.writeGitDone = true;
    try {
        if (gitAuthorName) {
            logger_1.logger.debug({ gitAuthorName }, 'Setting git author name');
            await git.addConfig('user.name', gitAuthorName);
        }
        if (gitAuthorEmail) {
            logger_1.logger.debug({ gitAuthorEmail }, 'Setting git author email');
            await git.addConfig('user.email', gitAuthorEmail);
        }
    }
    catch (err) /* istanbul ignore next */ {
        const errChecked = (0, error_1.checkForPlatformFailure)(err);
        if (errChecked) {
            throw errChecked;
        }
        logger_1.logger.debug({ err, gitAuthorName, gitAuthorEmail }, 'Error setting git author config');
        throw new Error(error_messages_1.TEMPORARY_ERROR);
    }
}
exports.writeGitAuthor = writeGitAuthor;
function setUserRepoConfig({ gitIgnoredAuthors, gitAuthor, }) {
    config.ignoredAuthors = gitIgnoredAuthors ?? [];
    setGitAuthor(gitAuthor);
}
exports.setUserRepoConfig = setUserRepoConfig;
async function getSubmodules() {
    try {
        return ((await git.raw([
            'config',
            '--file',
            '.gitmodules',
            '--get-regexp',
            '\\.path',
        ])) || '')
            .trim()
            .split((0, regex_1.regEx)(/[\n\s]/))
            .filter((_e, i) => i % 2);
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.warn({ err }, 'Error getting submodules');
        return [];
    }
}
exports.getSubmodules = getSubmodules;
async function syncGit() {
    if (gitInitialized) {
        return;
    }
    gitInitialized = true;
    const localDir = global_1.GlobalConfig.get('localDir');
    logger_1.logger.debug(`Initializing git repository into ${localDir}`);
    const gitHead = upath_1.default.join(localDir, '.git/HEAD');
    let clone = true;
    if (await fs_extra_1.default.pathExists(gitHead)) {
        try {
            await git.raw(['remote', 'set-url', 'origin', config.url]);
            await resetToBranch(await getDefaultBranch(git));
            const fetchStart = Date.now();
            await gitRetry(() => git.pull());
            await gitRetry(() => git.fetch());
            config.currentBranch =
                config.currentBranch || (await getDefaultBranch(git));
            await resetToBranch(config.currentBranch);
            await cleanLocalBranches();
            await gitRetry(() => git.raw(['remote', 'prune', 'origin']));
            const durationMs = Math.round(Date.now() - fetchStart);
            logger_1.logger.info({ durationMs }, 'git fetch completed');
            clone = false;
        }
        catch (err) /* istanbul ignore next */ {
            if (err.message === error_messages_1.REPOSITORY_EMPTY) {
                throw err;
            }
            logger_1.logger.info({ err }, 'git fetch error');
        }
    }
    if (clone) {
        const cloneStart = Date.now();
        try {
            const opts = [];
            if (config.fullClone) {
                logger_1.logger.debug('Performing full clone');
            }
            else {
                logger_1.logger.debug('Performing blobless clone');
                opts.push('--filter=blob:none');
            }
            if (config.extraCloneOpts) {
                Object.entries(config.extraCloneOpts).forEach((e) => opts.push(e[0], `${e[1]}`));
            }
            const emptyDirAndClone = async () => {
                await fs_extra_1.default.emptyDir(localDir);
                await git.clone(config.url, '.', opts);
            };
            await gitRetry(() => emptyDirAndClone());
        }
        catch (err) /* istanbul ignore next */ {
            logger_1.logger.debug({ err }, 'git clone error');
            if (err.message?.includes('No space left on device')) {
                throw new Error(error_messages_1.SYSTEM_INSUFFICIENT_DISK_SPACE);
            }
            if (err.message === error_messages_1.REPOSITORY_EMPTY) {
                throw err;
            }
            throw new external_host_error_1.ExternalHostError(err, 'git');
        }
        const durationMs = Math.round(Date.now() - cloneStart);
        logger_1.logger.debug({ durationMs }, 'git clone completed');
    }
    config.currentBranchSha = (await git.raw(['rev-parse', 'HEAD'])).trim();
    if (config.cloneSubmodules) {
        const submodules = await getSubmodules();
        for (const submodule of submodules) {
            try {
                logger_1.logger.debug(`Cloning git submodule at ${submodule}`);
                await gitRetry(() => git.submoduleUpdate(['--init', submodule]));
            }
            catch (err) {
                logger_1.logger.warn({ err }, `Unable to initialise git submodule at ${submodule}`);
            }
        }
    }
    try {
        const latestCommit = (await git.log({ n: 1 })).latest;
        logger_1.logger.debug({ latestCommit }, 'latest repository commit');
    }
    catch (err) /* istanbul ignore next */ {
        const errChecked = (0, error_1.checkForPlatformFailure)(err);
        if (errChecked) {
            throw errChecked;
        }
        if (err.message.includes('does not have any commits yet')) {
            throw new Error(error_messages_1.REPOSITORY_EMPTY);
        }
        logger_1.logger.warn({ err }, 'Cannot retrieve latest commit');
    }
    config.currentBranch = config.currentBranch || (await getDefaultBranch(git));
}
exports.syncGit = syncGit;
// istanbul ignore next
async function getRepoStatus() {
    await syncGit();
    return git.status();
}
exports.getRepoStatus = getRepoStatus;
function branchExists(branchName) {
    return !!config.branchCommits[branchName];
}
exports.branchExists = branchExists;
// Return the commit SHA for a branch
function getBranchCommit(branchName) {
    return config.branchCommits[branchName] || null;
}
exports.getBranchCommit = getBranchCommit;
// Return the parent commit SHA for a branch
async function getBranchParentSha(branchName) {
    try {
        const branchSha = getBranchCommit(branchName);
        const parentSha = await git.revparse([`${branchSha}^`]);
        return parentSha;
    }
    catch (err) {
        logger_1.logger.debug({ err }, 'Error getting branch parent sha');
        return null;
    }
}
exports.getBranchParentSha = getBranchParentSha;
async function getCommitMessages() {
    await syncGit();
    logger_1.logger.debug('getCommitMessages');
    const res = await git.log({
        n: 10,
        format: { message: '%s' },
    });
    return res.all.map((commit) => commit.message);
}
exports.getCommitMessages = getCommitMessages;
async function checkoutBranch(branchName) {
    logger_1.logger.debug(`Setting current branch to ${branchName}`);
    await syncGit();
    try {
        config.currentBranch = branchName;
        config.currentBranchSha = (await git.raw(['rev-parse', 'origin/' + branchName])).trim();
        await gitRetry(() => git.checkout(['-f', branchName, '--']));
        const latestCommitDate = (await git.log({ n: 1 }))?.latest?.date;
        if (latestCommitDate) {
            logger_1.logger.debug({ branchName, latestCommitDate }, 'latest commit');
        }
        await git.reset(simple_git_1.ResetMode.HARD);
        return config.currentBranchSha;
    }
    catch (err) /* istanbul ignore next */ {
        const errChecked = (0, error_1.checkForPlatformFailure)(err);
        if (errChecked) {
            throw errChecked;
        }
        if (err.message?.includes('fatal: ambiguous argument')) {
            logger_1.logger.warn({ err }, 'Failed to checkout branch');
            throw new Error(error_messages_1.TEMPORARY_ERROR);
        }
        throw err;
    }
}
exports.checkoutBranch = checkoutBranch;
async function getFileList() {
    await syncGit();
    const branch = config.currentBranch;
    const submodules = await getSubmodules();
    let files;
    try {
        files = await git.raw(['ls-tree', '-r', branch]);
    }
    catch (err) /* istanbul ignore next */ {
        if (err.message?.includes('fatal: Not a valid object name')) {
            logger_1.logger.debug({ err }, 'Branch not found when checking branch list - aborting');
            throw new Error(error_messages_1.REPOSITORY_CHANGED);
        }
        throw err;
    }
    // istanbul ignore if
    if (!files) {
        return [];
    }
    return files
        .split(regex_1.newlineRegex)
        .filter(is_1.default.string)
        .filter((line) => line.startsWith('100'))
        .map((line) => line.split((0, regex_1.regEx)(/\t/)).pop())
        .filter((file) => submodules.every((submodule) => !file.startsWith(submodule)));
}
exports.getFileList = getFileList;
function getBranchList() {
    return Object.keys(config.branchCommits);
}
exports.getBranchList = getBranchList;
async function isBranchStale(branchName) {
    await syncGit();
    try {
        const { currentBranchSha, currentBranch } = config;
        const branches = await git.branch([
            '--remotes',
            '--verbose',
            '--contains',
            config.currentBranchSha,
        ]);
        const isStale = !branches.all.map(localName).includes(branchName);
        logger_1.logger.debug({ isStale, currentBranch, currentBranchSha }, `isBranchStale=${isStale}`);
        return isStale;
    }
    catch (err) /* istanbul ignore next */ {
        const errChecked = (0, error_1.checkForPlatformFailure)(err);
        if (errChecked) {
            throw errChecked;
        }
        throw err;
    }
}
exports.isBranchStale = isBranchStale;
async function isBranchModified(branchName) {
    await syncGit();
    // First check cache
    if (config.branchIsModified[branchName] !== undefined) {
        return config.branchIsModified[branchName];
    }
    if (!branchExists(branchName)) {
        logger_1.logger.debug({ branchName }, 'Branch does not exist - cannot check isModified');
        return false;
    }
    // Retrieve the author of the most recent commit
    let lastAuthor;
    try {
        lastAuthor = (await git.raw([
            'log',
            '-1',
            '--pretty=format:%ae',
            `origin/${branchName}`,
            '--',
        ])).trim();
    }
    catch (err) /* istanbul ignore next */ {
        if (err.message?.includes('fatal: bad revision')) {
            logger_1.logger.debug({ err }, 'Remote branch not found when checking last commit author - aborting run');
            throw new Error(error_messages_1.REPOSITORY_CHANGED);
        }
        logger_1.logger.warn({ err }, 'Error checking last author for isBranchModified');
    }
    const { gitAuthorEmail } = config;
    if (lastAuthor === gitAuthorEmail ||
        config.ignoredAuthors.some((ignoredAuthor) => lastAuthor === ignoredAuthor)) {
        // author matches - branch has not been modified
        logger_1.logger.debug({ branchName }, 'Branch has not been modified');
        config.branchIsModified[branchName] = false;
        return false;
    }
    logger_1.logger.debug({ branchName, lastAuthor, gitAuthorEmail }, 'Last commit author does not match git author email - branch has been modified');
    config.branchIsModified[branchName] = true;
    return true;
}
exports.isBranchModified = isBranchModified;
async function isBranchConflicted(baseBranch, branch) {
    logger_1.logger.debug(`isBranchConflicted(${baseBranch}, ${branch})`);
    await syncGit();
    await writeGitAuthor();
    const baseBranchSha = getBranchCommit(baseBranch);
    const branchSha = getBranchCommit(branch);
    if (!baseBranchSha || !branchSha) {
        logger_1.logger.warn({ baseBranch, branch }, 'isBranchConflicted: branch does not exist');
        return true;
    }
    const cachedResult = (0, conflicts_cache_1.getCachedConflictResult)(baseBranch, baseBranchSha, branch, branchSha);
    if (is_1.default.boolean(cachedResult)) {
        logger_1.logger.debug(`Using cached result ${cachedResult} for isBranchConflicted(${baseBranch}, ${branch})`);
        return cachedResult;
    }
    let result = false;
    const origBranch = config.currentBranch;
    try {
        await git.reset(simple_git_1.ResetMode.HARD);
        if (origBranch !== baseBranch) {
            await git.checkout(baseBranch);
        }
        await git.merge(['--no-commit', '--no-ff', `origin/${branch}`]);
    }
    catch (err) {
        result = true;
        // istanbul ignore if: not easily testable
        if (!err?.git?.conflicts?.length) {
            logger_1.logger.debug({ baseBranch, branch, err }, 'isBranchConflicted: unknown error');
        }
    }
    finally {
        try {
            await git.merge(['--abort']);
            if (origBranch !== baseBranch) {
                await git.checkout(origBranch);
            }
        }
        catch (err) /* istanbul ignore next */ {
            logger_1.logger.debug({ baseBranch, branch, err }, 'isBranchConflicted: cleanup error');
        }
    }
    (0, conflicts_cache_1.setCachedConflictResult)(baseBranch, baseBranchSha, branch, branchSha, result);
    return result;
}
exports.isBranchConflicted = isBranchConflicted;
async function deleteBranch(branchName) {
    await syncGit();
    try {
        await gitRetry(() => git.raw(['push', '--delete', 'origin', branchName]));
        logger_1.logger.debug({ branchName }, 'Deleted remote branch');
    }
    catch (err) /* istanbul ignore next */ {
        const errChecked = (0, error_1.checkForPlatformFailure)(err);
        if (errChecked) {
            throw errChecked;
        }
        logger_1.logger.debug({ branchName }, 'No remote branch to delete');
    }
    try {
        await deleteLocalBranch(branchName);
        // istanbul ignore next
        logger_1.logger.debug({ branchName }, 'Deleted local branch');
    }
    catch (err) {
        const errChecked = (0, error_1.checkForPlatformFailure)(err);
        // istanbul ignore if
        if (errChecked) {
            throw errChecked;
        }
        logger_1.logger.debug({ branchName }, 'No local branch to delete');
    }
    delete config.branchCommits[branchName];
}
exports.deleteBranch = deleteBranch;
async function mergeBranch(branchName) {
    let status;
    try {
        await syncGit();
        await git.reset(simple_git_1.ResetMode.HARD);
        await gitRetry(() => git.checkout(['-B', branchName, 'origin/' + branchName]));
        await gitRetry(() => git.checkout([
            '-B',
            config.currentBranch,
            'origin/' + config.currentBranch,
        ]));
        status = await git.status();
        await gitRetry(() => git.merge(['--ff-only', branchName]));
        await gitRetry(() => git.push('origin', config.currentBranch));
        (0, limits_1.incLimitedValue)(limits_1.Limit.Commits);
    }
    catch (err) {
        logger_1.logger.debug({
            baseBranch: config.currentBranch,
            baseSha: config.currentBranchSha,
            branchName,
            branchSha: getBranchCommit(branchName),
            status,
            err,
        }, 'mergeBranch error');
        throw err;
    }
}
exports.mergeBranch = mergeBranch;
async function getBranchLastCommitTime(branchName) {
    await syncGit();
    try {
        const time = await git.show(['-s', '--format=%ai', 'origin/' + branchName]);
        return new Date(Date.parse(time));
    }
    catch (err) {
        const errChecked = (0, error_1.checkForPlatformFailure)(err);
        // istanbul ignore if
        if (errChecked) {
            throw errChecked;
        }
        return new Date();
    }
}
exports.getBranchLastCommitTime = getBranchLastCommitTime;
async function getBranchFiles(branchName) {
    await syncGit();
    try {
        const diff = await gitRetry(() => git.diffSummary([`origin/${branchName}`, `origin/${branchName}^`]));
        return diff.files.map((file) => file.file);
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.warn({ err }, 'getBranchFiles error');
        const errChecked = (0, error_1.checkForPlatformFailure)(err);
        if (errChecked) {
            throw errChecked;
        }
        return null;
    }
}
exports.getBranchFiles = getBranchFiles;
async function getFile(filePath, branchName) {
    await syncGit();
    try {
        const content = await git.show([
            'origin/' + (branchName || config.currentBranch) + ':' + filePath,
        ]);
        return content;
    }
    catch (err) {
        const errChecked = (0, error_1.checkForPlatformFailure)(err);
        // istanbul ignore if
        if (errChecked) {
            throw errChecked;
        }
        return null;
    }
}
exports.getFile = getFile;
async function hasDiff(branchName) {
    await syncGit();
    try {
        return (await gitRetry(() => git.diff(['HEAD', branchName]))) !== '';
    }
    catch (err) {
        return true;
    }
}
exports.hasDiff = hasDiff;
async function handleCommitAuth(localDir) {
    if (!privateKeySet) {
        await (0, private_key_1.writePrivateKey)();
        privateKeySet = true;
    }
    await (0, private_key_1.configSigningKey)(localDir);
    await writeGitAuthor();
}
/**
 *
 * Prepare local branch with commit
 *
 * 0. Hard reset
 * 1. Creates local branch with `origin/` prefix
 * 2. Perform `git add` (respecting mode) and `git remove` for each file
 * 3. Perform commit
 * 4. Check whether resulting commit is empty or not (due to .gitignore)
 * 5. If not empty, return commit info for further processing
 *
 */
async function prepareCommit({ branchName, files, message, force = false, }) {
    const localDir = global_1.GlobalConfig.get('localDir');
    await syncGit();
    logger_1.logger.debug(`Preparing files for committing to branch ${branchName}`);
    await handleCommitAuth(localDir);
    try {
        await git.reset(simple_git_1.ResetMode.HARD);
        await git.raw(['clean', '-fd']);
        const parentCommitSha = config.currentBranchSha;
        await gitRetry(() => git.checkout(['-B', branchName, 'origin/' + config.currentBranch]));
        const deletedFiles = [];
        const addedModifiedFiles = [];
        const ignoredFiles = [];
        for (const file of files) {
            const fileName = file.path;
            if (file.type === 'deletion') {
                try {
                    await git.rm([fileName]);
                    deletedFiles.push(fileName);
                }
                catch (err) /* istanbul ignore next */ {
                    const errChecked = (0, error_1.checkForPlatformFailure)(err);
                    if (errChecked) {
                        throw errChecked;
                    }
                    logger_1.logger.trace({ err, fileName }, 'Cannot delete file');
                    ignoredFiles.push(fileName);
                }
            }
            else {
                if (await isDirectory(upath_1.default.join(localDir, fileName))) {
                    // This is usually a git submodule update
                    logger_1.logger.trace({ fileName }, 'Adding directory commit');
                }
                else if (file.contents === null) {
                    continue;
                }
                else {
                    let contents;
                    // istanbul ignore else
                    if (typeof file.contents === 'string') {
                        contents = Buffer.from(file.contents);
                    }
                    else {
                        contents = file.contents;
                    }
                    // some file systems including Windows don't support the mode
                    // so the index should be manually updated after adding the file
                    await fs_extra_1.default.outputFile(upath_1.default.join(localDir, fileName), contents, {
                        mode: file.isExecutable ? 0o777 : 0o666,
                    });
                }
                try {
                    // istanbul ignore next
                    const addParams = fileName === app_strings_1.configFileNames[0] ? ['-f', fileName] : fileName;
                    await git.add(addParams);
                    if (file.isExecutable) {
                        await git.raw(['update-index', '--chmod=+x', fileName]);
                    }
                    addedModifiedFiles.push(fileName);
                }
                catch (err) /* istanbul ignore next */ {
                    if (!err.message.includes('The following paths are ignored by one of your .gitignore files')) {
                        throw err;
                    }
                    logger_1.logger.debug({ fileName }, 'Cannot commit ignored file');
                    ignoredFiles.push(file.path);
                }
            }
        }
        const commitOptions = {};
        if ((0, config_1.getNoVerify)().includes('commit')) {
            commitOptions['--no-verify'] = null;
        }
        const commitRes = await git.commit(message, [], commitOptions);
        if (commitRes.summary &&
            commitRes.summary.changes === 0 &&
            commitRes.summary.insertions === 0 &&
            commitRes.summary.deletions === 0) {
            logger_1.logger.warn({ commitRes }, 'Detected empty commit - aborting git push');
            return null;
        }
        logger_1.logger.debug({ deletedFiles, ignoredFiles, result: commitRes }, `git commit`);
        if (!force && !(await hasDiff(`origin/${branchName}`))) {
            logger_1.logger.debug({ branchName, deletedFiles, addedModifiedFiles, ignoredFiles }, 'No file changes detected. Skipping commit');
            return null;
        }
        const commitSha = (await git.revparse([branchName])).trim();
        const result = {
            parentCommitSha,
            commitSha,
            files: files.filter((fileChange) => {
                if (fileChange.type === 'deletion') {
                    return deletedFiles.includes(fileChange.path);
                }
                return addedModifiedFiles.includes(fileChange.path);
            }),
        };
        return result;
    }
    catch (err) /* istanbul ignore next */ {
        return (0, error_1.handleCommitError)(files, branchName, err);
    }
}
exports.prepareCommit = prepareCommit;
async function pushCommit({ branchName, files, }) {
    await syncGit();
    logger_1.logger.debug(`Pushing branch ${branchName}`);
    let result = false;
    try {
        const pushOptions = {
            '--force-with-lease': null,
            '-u': null,
        };
        if ((0, config_1.getNoVerify)().includes('push')) {
            pushOptions['--no-verify'] = null;
        }
        const pushRes = await gitRetry(() => git.push('origin', `${branchName}:${branchName}`, pushOptions));
        delete pushRes.repo;
        logger_1.logger.debug({ result: pushRes }, 'git push');
        (0, limits_1.incLimitedValue)(limits_1.Limit.Commits);
        result = true;
    }
    catch (err) /* istanbul ignore next */ {
        (0, error_1.handleCommitError)(files, branchName, err);
    }
    return result;
}
exports.pushCommit = pushCommit;
async function fetchCommit({ branchName, files, }) {
    await syncGit();
    logger_1.logger.debug(`Fetching branch ${branchName}`);
    try {
        const ref = `refs/heads/${branchName}:refs/remotes/origin/${branchName}`;
        await gitRetry(() => git.fetch(['origin', ref, '--force']));
        const commit = (await git.revparse([branchName])).trim();
        config.branchCommits[branchName] = commit;
        config.branchIsModified[branchName] = false;
        return commit;
    }
    catch (err) /* istanbul ignore next */ {
        return (0, error_1.handleCommitError)(files, branchName, err);
    }
}
exports.fetchCommit = fetchCommit;
async function commitFiles(commitConfig) {
    try {
        const commitResult = await prepareCommit(commitConfig);
        if (commitResult) {
            const pushResult = await pushCommit(commitConfig);
            if (pushResult) {
                const { branchName } = commitConfig;
                const { commitSha } = commitResult;
                config.branchCommits[branchName] = commitSha;
                config.branchIsModified[branchName] = false;
                return commitSha;
            }
        }
        return null;
    }
    catch (err) /* istanbul ignore next */ {
        if (err.message.includes('[rejected] (stale info)')) {
            throw new Error(error_messages_1.REPOSITORY_CHANGED);
        }
        throw err;
    }
}
exports.commitFiles = commitFiles;
function getUrl({ protocol, auth, hostname, host, repository, }) {
    if (protocol === 'ssh') {
        return `git@${hostname}:${repository}.git`;
    }
    return url_1.default.format({
        protocol: protocol || 'https',
        auth,
        hostname,
        host,
        pathname: repository + '.git',
    });
}
exports.getUrl = getUrl;
let remoteRefsExist = false;
/**
 *
 * Non-branch refs allow us to store git objects without triggering CI pipelines.
 * It's useful for API-based branch rebasing.
 *
 * @see https://stackoverflow.com/questions/63866947/pushing-git-non-branch-references-to-a-remote/63868286
 *
 */
async function pushCommitToRenovateRef(commitSha, refName, section = 'branches') {
    const fullRefName = `refs/renovate/${section}/${refName}`;
    await git.raw(['update-ref', fullRefName, commitSha]);
    await git.push(['--force', 'origin', fullRefName]);
    remoteRefsExist = true;
}
exports.pushCommitToRenovateRef = pushCommitToRenovateRef;
/**
 *
 * Removes all remote "refs/renovate/*" refs in two steps:
 *
 * Step 1: list refs
 *
 *   $ git ls-remote origin "refs/renovate/*"
 *
 *   > cca38e9ea6d10946bdb2d0ca5a52c205783897aa        refs/renovate/foo
 *   > 29ac154936c880068994e17eb7f12da7fdca70e5        refs/renovate/bar
 *   > 3fafaddc339894b6d4f97595940fd91af71d0355        refs/renovate/baz
 *   > ...
 *
 * Step 2:
 *
 *   $ git push --delete origin refs/renovate/foo refs/renovate/bar refs/renovate/baz
 *
 */
async function clearRenovateRefs() {
    if (!gitInitialized || !remoteRefsExist) {
        return;
    }
    logger_1.logger.debug(`Cleaning up Renovate refs: refs/renovate/*`);
    const renovateRefs = [];
    const obsoleteRefs = [];
    try {
        const rawOutput = await git.listRemote([config.url, 'refs/renovate/*']);
        const refs = rawOutput
            .split(regex_1.newlineRegex)
            .map((line) => line.replace((0, regex_1.regEx)(/[0-9a-f]+\s+/i), '').trim())
            .filter((line) => line.startsWith('refs/renovate/'));
        renovateRefs.push(...refs);
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.warn({ err }, `Renovate refs cleanup error`);
    }
    const nonSectionedRefs = renovateRefs.filter((ref) => {
        return ref.split('/').length === 3;
    });
    obsoleteRefs.push(...nonSectionedRefs);
    const renovateBranchRefs = renovateRefs.filter((ref) => ref.startsWith('refs/renovate/branches/'));
    obsoleteRefs.push(...renovateBranchRefs);
    if (obsoleteRefs.length) {
        const pushOpts = ['--delete', 'origin', ...obsoleteRefs];
        await git.push(pushOpts);
    }
    remoteRefsExist = false;
}
exports.clearRenovateRefs = clearRenovateRefs;
const treeItemRegex = (0, regex_1.regEx)(/^(?<mode>\d{6})\s+(?<type>blob|tree)\s+(?<sha>[0-9a-f]{40})\s+(?<path>.*)$/);
const treeShaRegex = (0, regex_1.regEx)(/tree\s+(?<treeSha>[0-9a-f]{40})\s*/);
/**
 *
 * Obtain top-level items of commit tree.
 * We don't need subtree items, so here are 2 steps only.
 *
 * Step 1: commit SHA -> tree SHA
 *
 *   $ git cat-file -p <commit-sha>
 *
 *   > tree <tree-sha>
 *   > parent 59b8b0e79319b7dc38f7a29d618628f3b44c2fd7
 *   > ...
 *
 * Step 2: tree SHA -> tree items (top-level)
 *
 *   $ git cat-file -p <tree-sha>
 *
 *   > 040000 tree 389400684d1f004960addc752be13097fe85d776    src
 *   > ...
 *   > 100644 blob 7d2edde437ad4e7bceb70dbfe70e93350d99c98b    package.json
 *
 */
async function listCommitTree(commitSha) {
    const commitOutput = await git.catFile(['-p', commitSha]);
    const { treeSha } = treeShaRegex.exec(commitOutput)?.groups ??
        /* istanbul ignore next: will never happen */ {};
    const contents = await git.catFile(['-p', treeSha]);
    const lines = contents.split(regex_1.newlineRegex);
    const result = [];
    for (const line of lines) {
        const matchGroups = treeItemRegex.exec(line)?.groups;
        if (matchGroups) {
            const { path, mode, type, sha } = matchGroups;
            result.push({ path, mode, type, sha });
        }
    }
    return result;
}
exports.listCommitTree = listCommitTree;
//# sourceMappingURL=index.js.map