"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractContraints = exports.requireComposerDependencyInstallation = exports.getPhpConstraint = exports.getComposerArguments = exports.composerVersioningId = void 0;
const shlex_1 = require("shlex");
const global_1 = require("../../../config/global");
const logger_1 = require("../../../logger");
const composer_1 = require("../../versioning/composer");
Object.defineProperty(exports, "composerVersioningId", { enumerable: true, get: function () { return composer_1.id; } });
const depRequireInstall = new Set(['symfony/flex']);
function getComposerArguments(config, toolConstraint) {
    let args = '';
    if (config.composerIgnorePlatformReqs) {
        if (config.composerIgnorePlatformReqs.length === 0) {
            // TODO: toolConstraint.constraint can be null or undefined?
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            const major = composer_1.api.getMajor(toolConstraint.constraint);
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            const minor = composer_1.api.getMinor(toolConstraint.constraint);
            args += composer_1.api.matches(`${major}.${minor}`, '^2.2')
                ? " --ignore-platform-req='ext-*' --ignore-platform-req='lib-*'"
                : ' --ignore-platform-reqs';
        }
        else {
            config.composerIgnorePlatformReqs.forEach((req) => {
                args += ' --ignore-platform-req ' + (0, shlex_1.quote)(req);
            });
        }
    }
    args += ' --no-ansi --no-interaction';
    if (!global_1.GlobalConfig.get('allowScripts') || config.ignoreScripts) {
        args += ' --no-scripts --no-autoloader';
    }
    if (!global_1.GlobalConfig.get('allowPlugins') || config.ignorePlugins) {
        args += ' --no-plugins';
    }
    return args;
}
exports.getComposerArguments = getComposerArguments;
function getPhpConstraint(constraints) {
    const { php } = constraints;
    if (php) {
        logger_1.logger.debug('Using php constraint from config');
        return php;
    }
    return null;
}
exports.getPhpConstraint = getPhpConstraint;
function requireComposerDependencyInstallation(lock) {
    return (lock.packages?.some((p) => depRequireInstall.has(p.name)) === true ||
        lock['packages-dev']?.some((p) => depRequireInstall.has(p.name)) === true);
}
exports.requireComposerDependencyInstallation = requireComposerDependencyInstallation;
function extractContraints(composerJson, lockParsed) {
    const res = { composer: '1.*' };
    // extract php
    if (composerJson.config?.platform?.php) {
        res.php = composerJson.config.platform.php;
    }
    else if (composerJson.require?.php) {
        res.php = composerJson.require.php;
    }
    // extract direct composer dependency
    if (composerJson.require?.['composer/composer']) {
        res.composer = composerJson.require?.['composer/composer'];
    }
    else if (composerJson['require-dev']?.['composer/composer']) {
        res.composer = composerJson['require-dev']?.['composer/composer'];
    }
    // composer platform package
    else if (composerJson.require?.['composer']) {
        res.composer = composerJson.require?.['composer'];
    }
    else if (composerJson['require-dev']?.['composer']) {
        res.composer = composerJson['require-dev']?.['composer'];
    }
    // check last used composer version
    else if (lockParsed?.['plugin-api-version']) {
        const major = composer_1.api.getMajor(lockParsed?.['plugin-api-version']);
        const minor = composer_1.api.getMinor(lockParsed?.['plugin-api-version']);
        res.composer = `^${major}.${minor}`;
    }
    // check composer api dependency
    else if (composerJson.require?.['composer-runtime-api']) {
        const major = composer_1.api.getMajor(composerJson.require?.['composer-runtime-api']);
        const minor = composer_1.api.getMinor(composerJson.require?.['composer-runtime-api']);
        res.composer = `^${major}.${minor}`;
    }
    return res;
}
exports.extractContraints = extractContraints;
//# sourceMappingURL=utils.js.map