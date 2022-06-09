"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPackageFile = void 0;
const tslib_1 = require("tslib");
/* eslint no-plusplus: 0  */
const url_1 = require("url");
const github_url_from_git_1 = tslib_1.__importDefault(require("github-url-from-git"));
const moo_1 = tslib_1.__importDefault(require("moo"));
const logger_1 = require("../../../logger");
const regex_1 = require("../../../util/regex");
const docker_1 = require("../../datasource/docker");
const github_releases_1 = require("../../datasource/github-releases");
const github_tags_1 = require("../../datasource/github-tags");
const go_1 = require("../../datasource/go");
const dockerVersioning = tslib_1.__importStar(require("../../versioning/docker"));
function parseUrl(urlString) {
    // istanbul ignore if
    if (!urlString) {
        return null;
    }
    const url = (0, url_1.parse)(urlString);
    if (url.host !== 'github.com' || !url.path) {
        return null;
    }
    const path = url.path.split('/').slice(1);
    const repo = path[0] + '/' + path[1];
    let datasource = '';
    let currentValue = null;
    if (path[2] === 'releases' && path[3] === 'download') {
        datasource = github_releases_1.GithubReleasesDatasource.id;
        currentValue = path[4];
    }
    if (path[2] === 'archive') {
        datasource = github_tags_1.GithubTagsDatasource.id;
        currentValue = path[3];
        // Strip archive extension to get hash or tag.
        // Tolerates formats produced by Git(Hub|Lab) and allowed by http_archive
        // Note: Order matters in suffix list to strip, e.g. .tar.gz.
        for (const extension of ['.gz', '.bz2', '.xz', '.tar', '.tgz', '.zip']) {
            if (currentValue.endsWith(extension)) {
                currentValue = currentValue.slice(0, -extension.length);
            }
        }
    }
    if (currentValue) {
        return { datasource, repo, currentValue };
    }
    // istanbul ignore next
    return null;
}
const lexer = moo_1.default.states({
    main: {
        lineComment: { match: /#.*?$/ },
        leftParen: { match: '(' },
        rightParen: { match: ')' },
        longDoubleQuoted: {
            match: '"""',
            push: 'longDoubleQuoted',
        },
        doubleQuoted: {
            match: '"',
            push: 'doubleQuoted',
        },
        longSingleQuoted: {
            match: "'''",
            push: 'longSingleQuoted',
        },
        singleQuoted: {
            match: "'",
            push: 'singleQuoted',
        },
        def: {
            match: new RegExp([
                'container_pull',
                'http_archive',
                'http_file',
                'go_repository',
                'git_repository',
            ].join('|')),
        },
        unknown: moo_1.default.fallback,
    },
    longDoubleQuoted: {
        stringFinish: { match: '"""', pop: 1 },
        char: moo_1.default.fallback,
    },
    doubleQuoted: {
        stringFinish: { match: '"', pop: 1 },
        char: moo_1.default.fallback,
    },
    longSingleQuoted: {
        stringFinish: { match: "'''", pop: 1 },
        char: moo_1.default.fallback,
    },
    singleQuoted: {
        stringFinish: { match: "'", pop: 1 },
        char: moo_1.default.fallback,
    },
});
function parseContent(content) {
    lexer.reset(content);
    let balance = 0;
    let def = null;
    const result = [];
    const finishDef = () => {
        if (def !== null) {
            result.push(def);
        }
        def = null;
    };
    const startDef = () => {
        finishDef();
        def = '';
    };
    const updateDef = (chunk) => {
        if (def !== null) {
            def += chunk;
        }
    };
    let token = lexer.next();
    while (token) {
        const { type, value } = token;
        if (type === 'def') {
            startDef();
        }
        updateDef(value);
        if (type === 'leftParen') {
            balance += 1;
        }
        if (type === 'rightParen') {
            balance -= 1;
            if (balance <= 0) {
                finishDef();
            }
        }
        token = lexer.next();
    }
    return result;
}
function extractPackageFile(content, fileName) {
    const definitions = parseContent(content);
    if (!definitions.length) {
        logger_1.logger.debug({ fileName }, 'No matching bazel WORKSPACE definitions found');
        return null;
    }
    logger_1.logger.debug({ definitions }, `Found ${definitions.length} definitions`);
    const deps = [];
    definitions.forEach((def) => {
        logger_1.logger.debug({ def }, 'Checking bazel definition');
        const [depType] = def.split('(', 1);
        const dep = { depType, managerData: { def } };
        let depName;
        let importpath;
        let remote;
        let currentValue;
        let commit;
        let url;
        let sha256;
        let digest;
        let repository;
        let registry;
        let match = (0, regex_1.regEx)(/name\s*=\s*"([^"]+)"/).exec(def);
        if (match) {
            [, depName] = match;
        }
        match = (0, regex_1.regEx)(/digest\s*=\s*"([^"]+)"/).exec(def);
        if (match) {
            [, digest] = match;
        }
        match = (0, regex_1.regEx)(/registry\s*=\s*"([^"]+)"/).exec(def);
        if (match) {
            [, registry] = match;
        }
        match = (0, regex_1.regEx)(/repository\s*=\s*"([^"]+)"/).exec(def);
        if (match) {
            [, repository] = match;
        }
        match = (0, regex_1.regEx)(/remote\s*=\s*"([^"]+)"/).exec(def);
        if (match) {
            [, remote] = match;
        }
        match = (0, regex_1.regEx)(/tag\s*=\s*"([^"]+)"/).exec(def);
        if (match) {
            [, currentValue] = match;
        }
        match = (0, regex_1.regEx)(/url\s*=\s*"([^"]+)"/).exec(def);
        if (match) {
            [, url] = match;
        }
        match = (0, regex_1.regEx)(/urls\s*=\s*\[\s*"([^\]]+)",?\s*\]/).exec(def);
        if (match) {
            const urls = match[1].replace((0, regex_1.regEx)(/\s/g), '').split('","');
            url = urls.find(parseUrl);
        }
        match = (0, regex_1.regEx)(/commit\s*=\s*"([^"]+)"/).exec(def);
        if (match) {
            [, commit] = match;
        }
        match = (0, regex_1.regEx)(/sha256\s*=\s*"([^"]+)"/).exec(def);
        if (match) {
            [, sha256] = match;
        }
        match = (0, regex_1.regEx)(/importpath\s*=\s*"([^"]+)"/).exec(def);
        if (match) {
            [, importpath] = match;
        }
        logger_1.logger.debug({ dependency: depName, remote, currentValue });
        if (depType === 'git_repository' &&
            depName &&
            remote &&
            (currentValue || commit)) {
            dep.depName = depName;
            if (currentValue) {
                dep.currentValue = currentValue;
            }
            if (commit) {
                dep.currentDigest = commit;
            }
            // TODO: Check if we really need to use parse here or if it should always be a plain https url (#9605)
            const githubURL = (0, github_url_from_git_1.default)(remote);
            if (githubURL) {
                const repo = githubURL.substring('https://github.com/'.length);
                dep.datasource = github_releases_1.GithubReleasesDatasource.id;
                dep.packageName = repo;
                deps.push(dep);
            }
        }
        else if (depType === 'go_repository' &&
            depName &&
            importpath &&
            (currentValue || commit)) {
            dep.depName = depName;
            dep.currentValue = currentValue || commit?.substring(0, 7);
            dep.datasource = go_1.GoDatasource.id;
            dep.packageName = importpath;
            if (remote) {
                const remoteMatch = (0, regex_1.regEx)(/https:\/\/github\.com(?:.*\/)(([a-zA-Z]+)([-])?([a-zA-Z]+))/).exec(remote);
                if (remoteMatch && remoteMatch[0].length === remote.length) {
                    dep.packageName = remote.replace('https://', '');
                }
                else {
                    dep.skipReason = 'unsupported-remote';
                }
            }
            if (commit) {
                dep.currentValue = 'v0.0.0';
                dep.currentDigest = commit;
                dep.currentDigestShort = commit.substring(0, 7);
                dep.digestOneAndOnly = true;
            }
            deps.push(dep);
        }
        else if ((depType === 'http_archive' || depType === 'http_file') &&
            depName &&
            parseUrl(url) &&
            sha256) {
            const parsedUrl = parseUrl(url);
            // istanbul ignore if: needs test
            if (!parsedUrl) {
                return;
            }
            dep.depName = depName;
            dep.repo = parsedUrl.repo;
            if ((0, regex_1.regEx)(/^[a-f0-9]{40}$/i).test(parsedUrl.currentValue)) {
                dep.currentDigest = parsedUrl.currentValue;
            }
            else {
                dep.currentValue = parsedUrl.currentValue;
            }
            dep.datasource = parsedUrl.datasource;
            dep.packageName = dep.repo;
            deps.push(dep);
        }
        else if (depType === 'container_pull' &&
            currentValue &&
            digest &&
            repository &&
            registry) {
            dep.currentDigest = digest;
            dep.currentValue = currentValue;
            dep.depName = depName;
            dep.versioning = dockerVersioning.id;
            dep.datasource = docker_1.DockerDatasource.id;
            dep.packageName = repository;
            dep.registryUrls = [registry];
            deps.push(dep);
        }
        else {
            logger_1.logger.debug({ def }, 'Failed to find dependency in bazel WORKSPACE definition');
        }
    });
    if (!deps.length) {
        return null;
    }
    return { deps };
}
exports.extractPackageFile = extractPackageFile;
//# sourceMappingURL=extract.js.map