"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateInstallCommands = exports.resolveConstraint = exports.isDynamicInstall = exports.isBuildpack = exports.supportsDynamicInstall = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const shlex_1 = require("shlex");
const global_1 = require("../../config/global");
const logger_1 = require("../../logger");
const datasource_1 = require("../../modules/datasource");
const allVersioning = tslib_1.__importStar(require("../../modules/versioning"));
const composer_1 = require("../../modules/versioning/composer");
const npm_1 = require("../../modules/versioning/npm");
const pep440_1 = require("../../modules/versioning/pep440");
const ruby_1 = require("../../modules/versioning/ruby");
const semver_1 = require("../../modules/versioning/semver");
const allToolConfig = {
    bundler: {
        datasource: 'rubygems',
        depName: 'bundler',
        versioning: 'ruby',
    },
    cocoapods: {
        datasource: 'rubygems',
        depName: 'cocoapods',
        versioning: ruby_1.id,
    },
    composer: {
        datasource: 'github-releases',
        depName: 'composer/composer',
        versioning: composer_1.id,
    },
    corepack: {
        datasource: 'npm',
        depName: 'corepack',
        versioning: npm_1.id,
    },
    flux: {
        datasource: 'github-releases',
        depName: 'fluxcd/flux2',
        versioning: semver_1.id,
    },
    helm: {
        datasource: 'github-releases',
        depName: 'helm/helm',
        versioning: semver_1.id,
    },
    jb: {
        datasource: 'github-releases',
        depName: 'jsonnet-bundler/jsonnet-bundler',
        versioning: semver_1.id,
    },
    npm: {
        datasource: 'npm',
        depName: 'npm',
        hash: true,
        versioning: npm_1.id,
    },
    pnpm: {
        datasource: 'npm',
        depName: 'pnpm',
        versioning: npm_1.id,
    },
    poetry: {
        datasource: 'pypi',
        depName: 'poetry',
        versioning: pep440_1.id,
    },
    yarn: {
        datasource: 'npm',
        depName: 'yarn',
        versioning: npm_1.id,
    },
    'yarn-slim': {
        datasource: 'npm',
        depName: 'yarn',
        versioning: npm_1.id,
    },
};
function supportsDynamicInstall(toolName) {
    return !!allToolConfig[toolName];
}
exports.supportsDynamicInstall = supportsDynamicInstall;
function isBuildpack() {
    return !!process.env.BUILDPACK;
}
exports.isBuildpack = isBuildpack;
function isDynamicInstall(toolConstraints) {
    const { binarySource } = global_1.GlobalConfig.get();
    if (binarySource !== 'install') {
        return false;
    }
    if (!isBuildpack()) {
        logger_1.logger.warn('binarySource=install is only compatible with images derived from containerbase/buildpack');
        return false;
    }
    return !!toolConstraints?.every((toolConstraint) => supportsDynamicInstall(toolConstraint.toolName));
}
exports.isDynamicInstall = isDynamicInstall;
function isStable(version, versioning, latest) {
    if (!versioning.isStable(version)) {
        return false;
    }
    if (is_1.default.string(latest)) {
        if (versioning.isGreaterThan(version, latest)) {
            return false;
        }
    }
    return true;
}
async function resolveConstraint(toolConstraint) {
    const { toolName } = toolConstraint;
    const toolConfig = allToolConfig[toolName];
    if (!toolConfig) {
        throw new Error(`Invalid tool to install: ${toolName}`);
    }
    const versioning = allVersioning.get(toolConfig.versioning);
    let constraint = toolConstraint.constraint;
    if (constraint) {
        if (versioning.isValid(constraint)) {
            if (versioning.isSingleVersion(constraint)) {
                return constraint;
            }
        }
        else {
            logger_1.logger.warn({ toolName, constraint }, 'Invalid tool constraint');
            constraint = undefined;
        }
    }
    const pkgReleases = await (0, datasource_1.getPkgReleases)(toolConfig);
    const releases = pkgReleases?.releases ?? [];
    if (!releases?.length) {
        throw new Error('No tool releases found.');
    }
    const matchingReleases = releases.filter((r) => !constraint || versioning.matches(r.version, constraint));
    const stableMatchingVersion = matchingReleases
        .filter((r) => isStable(r.version, versioning, pkgReleases?.tags?.latest))
        .pop()?.version;
    if (stableMatchingVersion) {
        logger_1.logger.debug({ toolName, constraint, resolvedVersion: stableMatchingVersion }, 'Resolved stable matching version');
        return stableMatchingVersion;
    }
    const unstableMatchingVersion = matchingReleases.pop()?.version;
    if (unstableMatchingVersion) {
        logger_1.logger.debug({ toolName, constraint, resolvedVersion: unstableMatchingVersion }, 'Resolved unstable matching version');
        return unstableMatchingVersion;
    }
    const stableVersion = releases
        .filter((r) => isStable(r.version, versioning, pkgReleases?.tags?.latest))
        .pop()?.version;
    if (stableVersion) {
        logger_1.logger.warn({ toolName, constraint, stableVersion }, 'No matching tool versions found for constraint - using latest stable version');
    }
    const highestVersion = releases.pop().version;
    logger_1.logger.warn({ toolName, constraint, highestVersion }, 'No matching or stable tool versions found - using an unstable version');
    return highestVersion;
}
exports.resolveConstraint = resolveConstraint;
async function generateInstallCommands(toolConstraints) {
    const installCommands = [];
    if (toolConstraints?.length) {
        for (const toolConstraint of toolConstraints) {
            const toolVersion = await resolveConstraint(toolConstraint);
            const { toolName } = toolConstraint;
            const installCommand = `install-tool ${toolName} ${(0, shlex_1.quote)(toolVersion)}`;
            installCommands.push(installCommand);
            if (allToolConfig[toolName].hash) {
                installCommands.push(`hash -d ${toolName} 2>/dev/null || true`);
            }
        }
    }
    return installCommands;
}
exports.generateInstallCommands = generateInstallCommands;
//# sourceMappingURL=buildpack.js.map