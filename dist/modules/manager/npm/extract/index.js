"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractAllPackageFiles = exports.postExtract = exports.extractPackageFile = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const validate_npm_package_name_1 = tslib_1.__importDefault(require("validate-npm-package-name"));
const global_1 = require("../../../../config/global");
const error_messages_1 = require("../../../../constants/error-messages");
const logger_1 = require("../../../../logger");
const fs_1 = require("../../../../util/fs");
const regex_1 = require("../../../../util/regex");
const github_tags_1 = require("../../../datasource/github-tags");
const npm_1 = require("../../../datasource/npm");
const nodeVersioning = tslib_1.__importStar(require("../../../versioning/node"));
const npm_2 = require("../../../versioning/npm");
const locked_versions_1 = require("./locked-versions");
const monorepo_1 = require("./monorepo");
const type_1 = require("./type");
const yarn_1 = require("./yarn");
function parseDepName(depType, key) {
    if (depType !== 'resolutions') {
        return key;
    }
    const [, depName] = (0, regex_1.regEx)(/((?:@[^/]+\/)?[^/@]+)$/).exec(key) ?? [];
    return depName;
}
const RE_REPOSITORY_GITHUB_SSH_FORMAT = (0, regex_1.regEx)(/(?:git@)github.com:([^/]+)\/([^/.]+)(?:\.git)?/);
async function extractPackageFile(content, fileName, config) {
    logger_1.logger.trace(`npm.extractPackageFile(${fileName})`);
    logger_1.logger.trace({ content });
    const deps = [];
    let packageJson;
    try {
        packageJson = JSON.parse(content);
    }
    catch (err) {
        logger_1.logger.debug({ fileName }, 'Invalid JSON');
        return null;
    }
    if (packageJson._id && packageJson._args && packageJson._from) {
        logger_1.logger.debug('Ignoring vendorised package.json');
        return null;
    }
    if (fileName !== 'package.json' && packageJson.renovate) {
        const error = new Error(error_messages_1.CONFIG_VALIDATION);
        error.validationSource = fileName;
        error.validationError =
            'Nested package.json must not contain renovate configuration. Please use `packageRules` with `matchPaths` in your main config instead.';
        throw error;
    }
    const packageJsonName = packageJson.name;
    logger_1.logger.debug(`npm file ${fileName} has name ${JSON.stringify(packageJsonName)}`);
    const packageFileVersion = packageJson.version;
    let yarnWorkspacesPackages;
    if (is_1.default.array(packageJson.workspaces)) {
        yarnWorkspacesPackages = packageJson.workspaces;
    }
    else {
        yarnWorkspacesPackages = packageJson.workspaces?.packages;
    }
    const packageJsonType = (0, type_1.mightBeABrowserLibrary)(packageJson)
        ? 'library'
        : 'app';
    const lockFiles = {
        yarnLock: 'yarn.lock',
        packageLock: 'package-lock.json',
        shrinkwrapJson: 'npm-shrinkwrap.json',
        pnpmShrinkwrap: 'pnpm-lock.yaml',
    };
    for (const [key, val] of Object.entries(lockFiles)) {
        const filePath = (0, fs_1.getSiblingFileName)(fileName, val);
        if (await (0, fs_1.readLocalFile)(filePath, 'utf8')) {
            lockFiles[key] = filePath;
        }
        else {
            lockFiles[key] = undefined;
        }
    }
    lockFiles.npmLock = lockFiles.packageLock || lockFiles.shrinkwrapJson;
    delete lockFiles.packageLock;
    delete lockFiles.shrinkwrapJson;
    let npmrc;
    const npmrcFileName = (0, fs_1.getSiblingFileName)(fileName, '.npmrc');
    let repoNpmrc = await (0, fs_1.readLocalFile)(npmrcFileName, 'utf8');
    if (is_1.default.string(repoNpmrc)) {
        if (is_1.default.string(config.npmrc) && !config.npmrcMerge) {
            logger_1.logger.debug({ npmrcFileName }, 'Repo .npmrc file is ignored due to config.npmrc with config.npmrcMerge=false');
        }
        else {
            npmrc = config.npmrc || '';
            if (npmrc.length) {
                if (!npmrc.endsWith('\n')) {
                    npmrc += '\n';
                }
            }
            if (repoNpmrc?.includes('package-lock')) {
                logger_1.logger.debug('Stripping package-lock setting from .npmrc');
                repoNpmrc = repoNpmrc.replace((0, regex_1.regEx)(/(^|\n)package-lock.*?(\n|$)/g), '\n');
            }
            if (repoNpmrc.includes('=${') && !global_1.GlobalConfig.get('exposeAllEnv')) {
                logger_1.logger.debug({ npmrcFileName }, 'Stripping .npmrc file of lines with variables');
                repoNpmrc = repoNpmrc
                    .split(regex_1.newlineRegex)
                    .filter((line) => !line.includes('=${'))
                    .join('\n');
            }
            npmrc += repoNpmrc;
        }
    }
    const yarnrcYmlFileName = (0, fs_1.getSiblingFileName)(fileName, '.yarnrc.yml');
    const yarnZeroInstall = await (0, yarn_1.isZeroInstall)(yarnrcYmlFileName);
    let lernaJsonFile;
    let lernaPackages;
    let lernaClient;
    let hasFancyRefs = false;
    let lernaJson;
    try {
        lernaJsonFile = (0, fs_1.getSiblingFileName)(fileName, 'lerna.json');
        lernaJson = JSON.parse(await (0, fs_1.readLocalFile)(lernaJsonFile, 'utf8'));
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.warn({ err }, 'Could not parse lerna.json');
    }
    if (lernaJson && !lernaJson.useWorkspaces) {
        lernaPackages = lernaJson.packages;
        lernaClient =
            lernaJson.npmClient === 'yarn' || lockFiles.yarnLock ? 'yarn' : 'npm';
    }
    else {
        lernaJsonFile = undefined;
    }
    const depTypes = {
        dependencies: 'dependency',
        devDependencies: 'devDependency',
        optionalDependencies: 'optionalDependency',
        peerDependencies: 'peerDependency',
        engines: 'engine',
        volta: 'volta',
        resolutions: 'resolutions',
        packageManager: 'packageManager',
        overrides: 'overrides',
    };
    const constraints = {};
    function extractDependency(depType, depName, input) {
        const dep = {};
        if (!(0, validate_npm_package_name_1.default)(depName).validForOldPackages) {
            dep.skipReason = 'invalid-name';
            return dep;
        }
        if (typeof input !== 'string') {
            dep.skipReason = 'invalid-value';
            return dep;
        }
        dep.currentValue = input.trim();
        if (depType === 'engines' || depType === 'packageManager') {
            if (depName === 'node') {
                dep.datasource = github_tags_1.GithubTagsDatasource.id;
                dep.packageName = 'nodejs/node';
                dep.versioning = nodeVersioning.id;
                constraints.node = dep.currentValue;
            }
            else if (depName === 'yarn') {
                dep.datasource = npm_1.NpmDatasource.id;
                dep.commitMessageTopic = 'Yarn';
                constraints.yarn = dep.currentValue;
                if (dep.currentValue.startsWith('2') ||
                    dep.currentValue.startsWith('3')) {
                    dep.packageName = '@yarnpkg/cli';
                }
            }
            else if (depName === 'npm') {
                dep.datasource = npm_1.NpmDatasource.id;
                dep.commitMessageTopic = 'npm';
                constraints.npm = dep.currentValue;
            }
            else if (depName === 'pnpm') {
                dep.datasource = npm_1.NpmDatasource.id;
                dep.commitMessageTopic = 'pnpm';
            }
            else if (depName === 'vscode') {
                dep.datasource = github_tags_1.GithubTagsDatasource.id;
                dep.packageName = 'microsoft/vscode';
                constraints.vscode = dep.currentValue;
            }
            else {
                dep.skipReason = 'unknown-engines';
            }
            if (!(0, npm_2.isValid)(dep.currentValue)) {
                dep.skipReason = 'unknown-version';
            }
            return dep;
        }
        // support for volta
        if (depType === 'volta') {
            if (depName === 'node') {
                dep.datasource = github_tags_1.GithubTagsDatasource.id;
                dep.packageName = 'nodejs/node';
                dep.versioning = nodeVersioning.id;
            }
            else if (depName === 'yarn') {
                dep.datasource = npm_1.NpmDatasource.id;
                dep.commitMessageTopic = 'Yarn';
            }
            else if (depName === 'npm') {
                dep.datasource = npm_1.NpmDatasource.id;
            }
            else {
                dep.skipReason = 'unknown-volta';
            }
            if (!(0, npm_2.isValid)(dep.currentValue)) {
                dep.skipReason = 'unknown-version';
            }
            return dep;
        }
        if (dep.currentValue.startsWith('npm:')) {
            dep.npmPackageAlias = true;
            hasFancyRefs = true;
            const valSplit = dep.currentValue.replace('npm:', '').split('@');
            if (valSplit.length === 2) {
                dep.packageName = valSplit[0];
                dep.currentValue = valSplit[1];
            }
            else if (valSplit.length === 3) {
                dep.packageName = valSplit[0] + '@' + valSplit[1];
                dep.currentValue = valSplit[2];
            }
            else {
                logger_1.logger.debug('Invalid npm package alias: ' + dep.currentValue);
            }
        }
        if (dep.currentValue.startsWith('file:')) {
            dep.skipReason = 'file';
            hasFancyRefs = true;
            return dep;
        }
        if ((0, npm_2.isValid)(dep.currentValue)) {
            dep.datasource = npm_1.NpmDatasource.id;
            if (dep.currentValue === '*') {
                dep.skipReason = 'any-version';
            }
            if (dep.currentValue === '') {
                dep.skipReason = 'empty';
            }
            return dep;
        }
        const hashSplit = dep.currentValue.split('#');
        if (hashSplit.length !== 2) {
            dep.skipReason = 'unknown-version';
            return dep;
        }
        const [depNamePart, depRefPart] = hashSplit;
        let githubOwnerRepo;
        let githubOwner;
        let githubRepo;
        const matchUrlSshFormat = RE_REPOSITORY_GITHUB_SSH_FORMAT.exec(depNamePart);
        if (matchUrlSshFormat === null) {
            githubOwnerRepo = depNamePart
                .replace((0, regex_1.regEx)(/^github:/), '')
                .replace((0, regex_1.regEx)(/^git\+/), '')
                .replace((0, regex_1.regEx)(/^https:\/\/github\.com\//), '')
                .replace((0, regex_1.regEx)(/\.git$/), '');
            const githubRepoSplit = githubOwnerRepo.split('/');
            if (githubRepoSplit.length !== 2) {
                dep.skipReason = 'unknown-version';
                return dep;
            }
            [githubOwner, githubRepo] = githubRepoSplit;
        }
        else {
            githubOwner = matchUrlSshFormat[1];
            githubRepo = matchUrlSshFormat[2];
            githubOwnerRepo = `${githubOwner}/${githubRepo}`;
        }
        const githubValidRegex = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i; // TODO #12872 lookahead
        if (!githubValidRegex.test(githubOwner) ||
            !githubValidRegex.test(githubRepo)) {
            dep.skipReason = 'unknown-version';
            return dep;
        }
        if ((0, npm_2.isVersion)(depRefPart)) {
            dep.currentRawValue = dep.currentValue;
            dep.currentValue = depRefPart;
            dep.datasource = github_tags_1.GithubTagsDatasource.id;
            dep.packageName = githubOwnerRepo;
            dep.pinDigests = false;
        }
        else if ((0, regex_1.regEx)(/^[0-9a-f]{7}$/).test(depRefPart) ||
            (0, regex_1.regEx)(/^[0-9a-f]{40}$/).test(depRefPart)) {
            dep.currentRawValue = dep.currentValue;
            dep.currentValue = null;
            dep.currentDigest = depRefPart;
            dep.datasource = github_tags_1.GithubTagsDatasource.id;
            dep.packageName = githubOwnerRepo;
        }
        else {
            dep.skipReason = 'unversioned-reference';
            return dep;
        }
        dep.githubRepo = githubOwnerRepo;
        dep.sourceUrl = `https://github.com/${githubOwnerRepo}`;
        dep.gitRef = true;
        return dep;
    }
    /**
     * Used when there is a json object as a value in overrides block.
     * @param parents
     * @param child
     * @returns PackageDependency array
     */
    function extractOverrideDepsRec(parents, child) {
        const deps = [];
        if (!child || is_1.default.emptyObject(child)) {
            return deps;
        }
        for (const [overrideName, versionValue] of Object.entries(child)) {
            if (is_1.default.string(versionValue)) {
                // special handling for "." override depenency name
                // "." means the constraint is applied to the parent dep
                const currDepName = overrideName === '.' ? parents[parents.length - 1] : overrideName;
                const dep = {
                    depName: currDepName,
                    depType: 'overrides',
                    managerData: { parents: parents.slice() }, // set parents for dependency
                };
                setNodeCommitTopic(dep);
                deps.push({
                    ...dep,
                    ...extractDependency('overrides', currDepName, versionValue),
                });
            }
            else {
                // versionValue is an object, run recursively.
                parents.push(overrideName);
                const depsOfObject = extractOverrideDepsRec(parents, versionValue);
                deps.push(...depsOfObject);
            }
        }
        parents.pop();
        return deps;
    }
    for (const depType of Object.keys(depTypes)) {
        let dependencies = packageJson[depType];
        if (dependencies) {
            try {
                if (depType === 'packageManager') {
                    const match = (0, regex_1.regEx)('^(?<name>.+)@(?<range>.+)$').exec(dependencies);
                    // istanbul ignore next
                    if (!match?.groups) {
                        break;
                    }
                    dependencies = { [match.groups.name]: match.groups.range };
                }
                for (const [key, val] of Object.entries(dependencies)) {
                    const depName = parseDepName(depType, key);
                    let dep = {
                        depType,
                        depName,
                    };
                    if (depName !== key) {
                        dep.managerData = { key };
                    }
                    if (depType === 'overrides' && !is_1.default.string(val)) {
                        deps.push(...extractOverrideDepsRec([depName], val));
                    }
                    else {
                        dep = { ...dep, ...extractDependency(depType, depName, val) };
                        setNodeCommitTopic(dep);
                        dep.prettyDepType = depTypes[depType];
                        deps.push(dep);
                    }
                }
            }
            catch (err) /* istanbul ignore next */ {
                logger_1.logger.debug({ fileName, depType, err }, 'Error parsing package.json');
                return null;
            }
        }
    }
    if (deps.length === 0) {
        logger_1.logger.debug('Package file has no deps');
        if (!(packageJsonName ||
            packageFileVersion ||
            npmrc ||
            lernaJsonFile ||
            yarnWorkspacesPackages)) {
            logger_1.logger.debug('Skipping file');
            return null;
        }
    }
    let skipInstalls = config.skipInstalls;
    if (skipInstalls === null) {
        if ((hasFancyRefs && lockFiles.npmLock) || yarnZeroInstall) {
            // https://github.com/npm/cli/issues/1432
            // Explanation:
            //  - npm install --package-lock-only is buggy for transitive deps in file: and npm: references
            //  - So we set skipInstalls to false if file: or npm: refs are found *and* the user hasn't explicitly set the value already
            //  - Also, do not skip install if Yarn zero-install is used
            logger_1.logger.debug('Automatically setting skipInstalls to false');
            skipInstalls = false;
        }
        else {
            skipInstalls = true;
        }
    }
    return {
        deps,
        packageJsonName,
        packageFileVersion,
        packageJsonType,
        npmrc,
        ...lockFiles,
        managerData: {
            lernaJsonFile,
            yarnZeroInstall,
            hasPackageManager: is_1.default.nonEmptyStringAndNotWhitespace(packageJson.packageManager),
        },
        lernaClient,
        lernaPackages,
        skipInstalls,
        yarnWorkspacesPackages,
        constraints,
    };
}
exports.extractPackageFile = extractPackageFile;
async function postExtract(packageFiles) {
    await (0, monorepo_1.detectMonorepos)(packageFiles);
    await (0, locked_versions_1.getLockedVersions)(packageFiles);
}
exports.postExtract = postExtract;
async function extractAllPackageFiles(config, packageFiles) {
    const npmFiles = [];
    for (const packageFile of packageFiles) {
        const content = await (0, fs_1.readLocalFile)(packageFile, 'utf8');
        // istanbul ignore else
        if (content) {
            const deps = await extractPackageFile(content, packageFile, config);
            if (deps) {
                npmFiles.push({
                    packageFile,
                    ...deps,
                });
            }
        }
        else {
            logger_1.logger.debug({ packageFile }, 'packageFile has no content');
        }
    }
    await postExtract(npmFiles);
    return npmFiles;
}
exports.extractAllPackageFiles = extractAllPackageFiles;
function setNodeCommitTopic(dep) {
    // This is a special case for Node.js to group it together with other managers
    if (dep.depName === 'node') {
        dep.commitMessageTopic = 'Node.js';
    }
}
//# sourceMappingURL=index.js.map