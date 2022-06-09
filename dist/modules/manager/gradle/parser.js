"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseProps = exports.parseGradle = void 0;
const tslib_1 = require("tslib");
const url_1 = tslib_1.__importDefault(require("url"));
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const logger_1 = require("../../../logger");
const regex_1 = require("../../../util/regex");
const common_1 = require("./common");
const tokenizer_1 = require("./tokenizer");
const utils_1 = require("./utils");
function matchTokens(tokens, matchers) {
    let lookaheadCount = 0;
    const result = {};
    for (let idx = 0; idx < matchers.length; idx += 1) {
        const token = tokens[idx];
        const matcher = matchers[idx];
        if (!token) {
            if (matcher.lookahead) {
                break;
            }
            return null;
        }
        const typeMatches = is_1.default.string(matcher.matchType)
            ? matcher.matchType === token.type
            : matcher.matchType.includes(token.type);
        if (!typeMatches) {
            return null;
        }
        if (is_1.default.string(matcher.matchValue) && token.value !== matcher.matchValue) {
            return null;
        }
        if (is_1.default.array(matcher.matchValue) &&
            !matcher.matchValue.includes(token.value)) {
            return null;
        }
        lookaheadCount = matcher.lookahead ? lookaheadCount + 1 : 0;
        if (matcher.tokenMapKey) {
            result[matcher.tokenMapKey] = token;
        }
    }
    tokens.splice(0, matchers.length - lookaheadCount);
    return result;
}
const endOfInstruction = {
    // Ensure we skip assignments of complex expressions (not strings)
    matchType: [
        common_1.TokenType.Semicolon,
        common_1.TokenType.RightBrace,
        common_1.TokenType.Word,
        common_1.TokenType.String,
        common_1.TokenType.StringInterpolation,
    ],
    lookahead: true,
};
const potentialStringTypes = [common_1.TokenType.String, common_1.TokenType.Word];
function coercePotentialString(token, variables) {
    const tokenType = token?.type;
    if (tokenType === common_1.TokenType.String) {
        return token?.value;
    }
    if (tokenType === common_1.TokenType.Word &&
        typeof variables[token?.value] !== 'undefined') {
        return variables[token.value].value;
    }
    return null;
}
function handleAssignment({ packageFile, tokenMap, }) {
    const { objectToken, keyToken, valToken } = tokenMap;
    const obj = objectToken?.value;
    const key = obj ? `${obj}.${keyToken.value}` : keyToken.value;
    const dep = (0, utils_1.parseDependencyString)(valToken.value);
    if (dep) {
        dep.groupName = key;
        dep.managerData = {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            fileReplacePosition: valToken.offset + dep.depName.length + 1,
            packageFile,
        };
    }
    const varData = {
        key,
        value: valToken.value,
        fileReplacePosition: valToken.offset,
        packageFile,
    };
    const result = {
        vars: { [key]: varData },
        deps: dep ? [dep] : [],
    };
    return result;
}
function processDepString({ packageFile, tokenMap, }) {
    const { token } = tokenMap;
    const dep = (0, utils_1.parseDependencyString)(token.value);
    if (dep) {
        dep.managerData = {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            fileReplacePosition: token.offset + dep.depName.length + 1,
            packageFile,
        };
        return { deps: [dep] };
    }
    return null;
}
function processDepInterpolation({ tokenMap, variables, packageFile: packageFileOrig, }) {
    const token = tokenMap.depInterpolation;
    const interpolationResult = (0, utils_1.interpolateString)(token.children, variables);
    if (interpolationResult && (0, utils_1.isDependencyString)(interpolationResult)) {
        const dep = (0, utils_1.parseDependencyString)(interpolationResult);
        if (dep) {
            let packageFile;
            let fileReplacePosition;
            token.children.forEach((child) => {
                const variable = variables[child.value];
                if (child?.type === common_1.TokenType.Variable && variable) {
                    packageFile = variable.packageFile;
                    fileReplacePosition = variable.fileReplacePosition;
                    if (variable?.value === dep.currentValue) {
                        dep.managerData = { fileReplacePosition, packageFile };
                        dep.groupName = variable.key;
                    }
                }
            });
            if (!dep.managerData) {
                const lastToken = token.children[token.children.length - 1];
                if (lastToken.type === common_1.TokenType.String &&
                    lastToken.value.startsWith(`:${dep.currentValue}`)) {
                    packageFile = packageFileOrig;
                    fileReplacePosition = lastToken.offset + 1;
                    delete dep.groupName;
                }
                else {
                    dep.skipReason = 'contains-variable';
                }
                dep.managerData = { fileReplacePosition, packageFile };
            }
            return { deps: [dep] };
        }
    }
    return null;
}
function processPlugin({ tokenMap, packageFile, variables, }) {
    const { pluginName, pluginVersion, methodName } = tokenMap;
    const plugin = pluginName.value;
    const depName = methodName.value === 'kotlin' ? `org.jetbrains.kotlin.${plugin}` : plugin;
    const packageName = methodName.value === 'kotlin'
        ? `org.jetbrains.kotlin.${plugin}:org.jetbrains.kotlin.${plugin}.gradle.plugin`
        : `${plugin}:${plugin}.gradle.plugin`;
    const dep = {
        depType: 'plugin',
        depName,
        packageName,
        registryUrls: ['https://plugins.gradle.org/m2/'],
        commitMessageTopic: `plugin ${depName}`,
    };
    if (pluginVersion.type === common_1.TokenType.Word) {
        const varData = variables[pluginVersion.value];
        if (varData) {
            const currentValue = varData.value;
            const fileReplacePosition = varData.fileReplacePosition;
            dep.currentValue = currentValue;
            dep.managerData = {
                fileReplacePosition,
                packageFile: varData.packageFile,
            };
        }
        else {
            const currentValue = pluginVersion.value;
            const fileReplacePosition = pluginVersion.offset;
            dep.currentValue = currentValue;
            dep.managerData = { fileReplacePosition, packageFile };
            dep.skipReason = 'unknown-version';
        }
    }
    else if (pluginVersion.type === common_1.TokenType.StringInterpolation) {
        const versionTpl = pluginVersion;
        const children = versionTpl.children;
        const [child] = children;
        if (child?.type === common_1.TokenType.Variable && children.length === 1) {
            const varData = variables[child.value];
            if (varData) {
                const currentValue = varData.value;
                const fileReplacePosition = varData.fileReplacePosition;
                dep.currentValue = currentValue;
                dep.managerData = {
                    fileReplacePosition,
                    packageFile: varData.packageFile,
                };
            }
            else {
                const currentValue = child.value;
                const fileReplacePosition = child.offset;
                dep.currentValue = currentValue;
                dep.managerData = { fileReplacePosition, packageFile };
                dep.skipReason = 'unknown-version';
            }
        }
        else {
            const fileReplacePosition = versionTpl.offset;
            dep.managerData = { fileReplacePosition, packageFile };
            dep.skipReason = 'unknown-version';
        }
    }
    else {
        const currentValue = pluginVersion.value;
        const fileReplacePosition = pluginVersion.offset;
        dep.currentValue = currentValue;
        dep.managerData = { fileReplacePosition, packageFile };
    }
    return { deps: [dep] };
}
function processCustomRegistryUrl({ tokenMap, variables, }) {
    let registryUrl = tokenMap.registryUrl?.value;
    if (tokenMap.registryUrl?.type === common_1.TokenType.StringInterpolation) {
        const token = tokenMap.registryUrl;
        registryUrl = (0, utils_1.interpolateString)(token.children, variables);
    }
    try {
        if (registryUrl) {
            const { host, protocol } = url_1.default.parse(registryUrl);
            if (host && protocol) {
                return { urls: [registryUrl] };
            }
        }
    }
    catch (e) {
        // no-op
    }
    return null;
}
function processPredefinedRegistryUrl({ tokenMap, }) {
    const registryName = tokenMap.registryName?.value;
    const registryUrl = {
        mavenCentral: common_1.MAVEN_REPO,
        jcenter: common_1.JCENTER_REPO,
        google: common_1.GOOGLE_REPO,
        gradlePluginPortal: common_1.GRADLE_PLUGIN_PORTAL_REPO,
    }[registryName];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    return { urls: [registryUrl] };
}
const annoyingMethods = new Set([
    'createXmlValueRemover',
    'events',
    'args',
    'arrayOf',
    'listOf',
    'mutableListOf',
    'setOf',
    'mutableSetOf',
]);
function processLongFormDep({ tokenMap, variables, packageFile, }) {
    const groupId = coercePotentialString(tokenMap.groupId, variables);
    const artifactId = coercePotentialString(tokenMap.artifactId, variables);
    const version = coercePotentialString(tokenMap.version, variables);
    const dep = (0, utils_1.parseDependencyString)([groupId, artifactId, version].join(':'));
    if (dep) {
        const versionToken = tokenMap.version;
        if (versionToken.type === common_1.TokenType.Word) {
            const variable = variables[versionToken.value];
            dep.groupName = variable.key;
            dep.managerData = {
                fileReplacePosition: variable.fileReplacePosition,
                packageFile: variable.packageFile,
            };
        }
        else {
            dep.managerData = {
                fileReplacePosition: versionToken.offset,
                packageFile,
            };
        }
        const methodName = tokenMap.methodName?.value;
        if (annoyingMethods.has(methodName)) {
            dep.skipReason = 'ignored';
        }
        return { deps: [dep] };
    }
    return null;
}
function processLibraryDep(input) {
    const { tokenMap } = input;
    const varNameToken = tokenMap.varName;
    const key = varNameToken.value;
    const fileReplacePosition = varNameToken.offset;
    const packageFile = input.packageFile;
    const groupId = tokenMap.groupId?.value;
    const artifactId = tokenMap.artifactId?.value;
    const value = `${groupId}:${artifactId}`;
    const res = {};
    if (groupId && artifactId) {
        res.vars = { [key]: { key, value, fileReplacePosition, packageFile } };
        const versionRefToken = tokenMap.version;
        if (versionRefToken) {
            const version = { ...versionRefToken, type: common_1.TokenType.Word };
            const depRes = processLongFormDep({
                ...input,
                tokenMap: { ...input.tokenMap, version },
            });
            return { ...depRes, ...res };
        }
    }
    return res;
}
const matcherConfigs = [
    {
        // foo.bar = 'baz'
        matchers: [
            { matchType: common_1.TokenType.Word, tokenMapKey: 'objectToken' },
            { matchType: common_1.TokenType.Dot },
            { matchType: common_1.TokenType.Word, tokenMapKey: 'keyToken' },
            { matchType: common_1.TokenType.Assignment },
            { matchType: common_1.TokenType.String, tokenMapKey: 'valToken' },
            endOfInstruction,
        ],
        handler: handleAssignment,
    },
    {
        // foo = 'bar'
        matchers: [
            { matchType: common_1.TokenType.Word, tokenMapKey: 'keyToken' },
            { matchType: common_1.TokenType.Assignment },
            { matchType: common_1.TokenType.String, tokenMapKey: 'valToken' },
            endOfInstruction,
        ],
        handler: handleAssignment,
    },
    {
        // set('foo', 'bar')
        matchers: [
            { matchType: common_1.TokenType.Word, matchValue: ['set', 'version'] },
            { matchType: common_1.TokenType.LeftParen },
            { matchType: common_1.TokenType.String, tokenMapKey: 'keyToken' },
            { matchType: common_1.TokenType.Comma },
            { matchType: common_1.TokenType.String, tokenMapKey: 'valToken' },
            { matchType: common_1.TokenType.RightParen },
            endOfInstruction,
        ],
        handler: handleAssignment,
    },
    {
        // 'foo.bar:baz:1.2.3'
        // 'foo.bar:baz:1.2.3@ext'
        matchers: [
            {
                matchType: common_1.TokenType.String,
                tokenMapKey: 'token',
            },
        ],
        handler: processDepString,
    },
    {
        // "foo.bar:baz:${bazVersion}"
        // "foo.bar:baz:${bazVersion}@ext"
        matchers: [
            {
                matchType: common_1.TokenType.StringInterpolation,
                tokenMapKey: 'depInterpolation',
            },
        ],
        handler: processDepInterpolation,
    },
    {
        // id 'foo.bar' version '1.2.3'
        // id 'foo.bar' version fooBarVersion
        // id 'foo.bar' version "$fooBarVersion"
        matchers: [
            {
                matchType: common_1.TokenType.Word,
                matchValue: ['id', 'kotlin'],
                tokenMapKey: 'methodName',
            },
            { matchType: common_1.TokenType.String, tokenMapKey: 'pluginName' },
            { matchType: common_1.TokenType.Word, matchValue: 'version' },
            {
                matchType: [
                    common_1.TokenType.String,
                    common_1.TokenType.Word,
                    common_1.TokenType.StringInterpolation,
                ],
                tokenMapKey: 'pluginVersion',
            },
            endOfInstruction,
        ],
        handler: processPlugin,
    },
    {
        // id('foo.bar') version '1.2.3'
        // id('foo.bar') version fooBarVersion
        // id('foo.bar') version "$fooBarVersion"
        matchers: [
            {
                matchType: common_1.TokenType.Word,
                matchValue: ['id', 'kotlin'],
                tokenMapKey: 'methodName',
            },
            { matchType: common_1.TokenType.LeftParen },
            { matchType: common_1.TokenType.String, tokenMapKey: 'pluginName' },
            { matchType: common_1.TokenType.RightParen },
            { matchType: common_1.TokenType.Word, matchValue: 'version' },
            {
                matchType: [
                    common_1.TokenType.String,
                    common_1.TokenType.Word,
                    common_1.TokenType.StringInterpolation,
                ],
                tokenMapKey: 'pluginVersion',
            },
            endOfInstruction,
        ],
        handler: processPlugin,
    },
    {
        // mavenCentral()
        matchers: [
            {
                matchType: common_1.TokenType.Word,
                matchValue: ['mavenCentral', 'jcenter', 'google', 'gradlePluginPortal'],
                tokenMapKey: 'registryName',
            },
            { matchType: common_1.TokenType.LeftParen },
            { matchType: common_1.TokenType.RightParen },
            endOfInstruction,
        ],
        handler: processPredefinedRegistryUrl,
    },
    {
        // mavenCentral { content {
        matchers: [
            {
                matchType: common_1.TokenType.Word,
                matchValue: ['mavenCentral', 'jcenter', 'google', 'gradlePluginPortal'],
                tokenMapKey: 'registryName',
            },
            { matchType: common_1.TokenType.LeftBrace },
            {
                matchType: common_1.TokenType.Word,
                matchValue: ['content'],
            },
            {
                matchType: common_1.TokenType.LeftBrace,
                lookahead: true,
            },
        ],
        handler: processPredefinedRegistryUrl,
    },
    {
        // maven("https://repository.mycompany.com/m2/repository")
        matchers: [
            {
                matchType: common_1.TokenType.Word,
                matchValue: 'maven',
            },
            { matchType: common_1.TokenType.LeftParen },
            {
                matchType: [common_1.TokenType.String, common_1.TokenType.StringInterpolation],
                tokenMapKey: 'registryUrl',
            },
            { matchType: common_1.TokenType.RightParen },
            endOfInstruction,
        ],
        handler: processCustomRegistryUrl,
    },
    {
        // maven { url = "https://maven.springframework.org/release"
        matchers: [
            {
                matchType: common_1.TokenType.Word,
                matchValue: 'maven',
            },
            { matchType: common_1.TokenType.LeftBrace },
            {
                matchType: common_1.TokenType.Word,
                matchValue: 'url',
            },
            { matchType: common_1.TokenType.Assignment },
            {
                matchType: [common_1.TokenType.String, common_1.TokenType.StringInterpolation],
                tokenMapKey: 'registryUrl',
            },
            endOfInstruction,
        ],
        handler: processCustomRegistryUrl,
    },
    {
        // maven { url = uri("https://maven.springframework.org/release")
        matchers: [
            {
                matchType: common_1.TokenType.Word,
                matchValue: 'maven',
            },
            { matchType: common_1.TokenType.LeftBrace },
            {
                matchType: common_1.TokenType.Word,
                matchValue: 'url',
            },
            { matchType: common_1.TokenType.Assignment },
            {
                matchType: common_1.TokenType.Word,
                matchValue: 'uri',
            },
            { matchType: common_1.TokenType.LeftParen },
            {
                matchType: [common_1.TokenType.String, common_1.TokenType.StringInterpolation],
                tokenMapKey: 'registryUrl',
            },
            { matchType: common_1.TokenType.RightParen },
            endOfInstruction,
        ],
        handler: processCustomRegistryUrl,
    },
    {
        // maven { url "https://maven.springframework.org/release"
        matchers: [
            {
                matchType: common_1.TokenType.Word,
                matchValue: 'maven',
            },
            { matchType: common_1.TokenType.LeftBrace },
            {
                matchType: common_1.TokenType.Word,
                matchValue: 'url',
            },
            {
                matchType: [common_1.TokenType.String, common_1.TokenType.StringInterpolation],
                tokenMapKey: 'registryUrl',
            },
            endOfInstruction,
        ],
        handler: processCustomRegistryUrl,
    },
    {
        // url 'https://repo.spring.io/snapshot/'
        matchers: [
            { matchType: common_1.TokenType.Word, matchValue: ['uri', 'url'] },
            {
                matchType: [common_1.TokenType.String, common_1.TokenType.StringInterpolation],
                tokenMapKey: 'registryUrl',
            },
            endOfInstruction,
        ],
        handler: processCustomRegistryUrl,
    },
    {
        // url('https://repo.spring.io/snapshot/')
        matchers: [
            { matchType: common_1.TokenType.Word, matchValue: ['uri', 'url'] },
            { matchType: common_1.TokenType.LeftParen },
            {
                matchType: [common_1.TokenType.String, common_1.TokenType.StringInterpolation],
                tokenMapKey: 'registryUrl',
            },
            { matchType: common_1.TokenType.RightParen },
            endOfInstruction,
        ],
        handler: processCustomRegistryUrl,
    },
    {
        // library("foobar", "foo", "bar").versionRef("foo.bar")
        matchers: [
            { matchType: common_1.TokenType.Word, matchValue: 'library' },
            { matchType: common_1.TokenType.LeftParen },
            { matchType: common_1.TokenType.String, tokenMapKey: 'varName' },
            { matchType: common_1.TokenType.Comma },
            { matchType: potentialStringTypes, tokenMapKey: 'groupId' },
            { matchType: common_1.TokenType.Comma },
            { matchType: potentialStringTypes, tokenMapKey: 'artifactId' },
            { matchType: common_1.TokenType.RightParen },
            { matchType: common_1.TokenType.Dot },
            { matchType: common_1.TokenType.Word, matchValue: 'versionRef' },
            { matchType: common_1.TokenType.LeftParen },
            { matchType: common_1.TokenType.String, tokenMapKey: 'version' },
            { matchType: common_1.TokenType.RightParen },
        ],
        handler: processLibraryDep,
    },
    {
        // library("foobar", "foo", "bar")
        matchers: [
            { matchType: common_1.TokenType.Word, matchValue: 'library' },
            { matchType: common_1.TokenType.LeftParen },
            { matchType: common_1.TokenType.String, tokenMapKey: 'varName' },
            { matchType: common_1.TokenType.Comma },
            { matchType: potentialStringTypes, tokenMapKey: 'groupId' },
            { matchType: common_1.TokenType.Comma },
            { matchType: potentialStringTypes, tokenMapKey: 'artifactId' },
            { matchType: common_1.TokenType.RightParen },
        ],
        handler: processLibraryDep,
    },
    {
        // group: "com.example", name: "my.dependency", version: "1.2.3"
        matchers: [
            { matchType: common_1.TokenType.Word, matchValue: 'group' },
            { matchType: common_1.TokenType.Colon },
            { matchType: potentialStringTypes, tokenMapKey: 'groupId' },
            { matchType: common_1.TokenType.Comma },
            { matchType: common_1.TokenType.Word, matchValue: 'name' },
            { matchType: common_1.TokenType.Colon },
            { matchType: potentialStringTypes, tokenMapKey: 'artifactId' },
            { matchType: common_1.TokenType.Comma },
            { matchType: common_1.TokenType.Word, matchValue: 'version' },
            { matchType: common_1.TokenType.Colon },
            { matchType: potentialStringTypes, tokenMapKey: 'version' },
            endOfInstruction,
        ],
        handler: processLongFormDep,
    },
    {
        // (group: "com.example", name: "my.dependency", version: "1.2.3")
        matchers: [
            { matchType: common_1.TokenType.LeftParen },
            { matchType: common_1.TokenType.Word, matchValue: 'group' },
            { matchType: common_1.TokenType.Colon },
            { matchType: potentialStringTypes, tokenMapKey: 'groupId' },
            { matchType: common_1.TokenType.Comma },
            { matchType: common_1.TokenType.Word, matchValue: 'name' },
            { matchType: common_1.TokenType.Colon },
            { matchType: potentialStringTypes, tokenMapKey: 'artifactId' },
            { matchType: common_1.TokenType.Comma },
            { matchType: common_1.TokenType.Word, matchValue: 'version' },
            { matchType: common_1.TokenType.Colon },
            { matchType: potentialStringTypes, tokenMapKey: 'version' },
            { matchType: common_1.TokenType.RightParen },
            endOfInstruction,
        ],
        handler: processLongFormDep,
    },
    {
        // group: "com.example", name: "my.dependency", version: "1.2.3", classifier:"class"
        matchers: [
            { matchType: common_1.TokenType.Word, matchValue: 'group' },
            { matchType: common_1.TokenType.Colon },
            { matchType: potentialStringTypes, tokenMapKey: 'groupId' },
            { matchType: common_1.TokenType.Comma },
            { matchType: common_1.TokenType.Word, matchValue: 'name' },
            { matchType: common_1.TokenType.Colon },
            { matchType: potentialStringTypes, tokenMapKey: 'artifactId' },
            { matchType: common_1.TokenType.Comma },
            { matchType: common_1.TokenType.Word, matchValue: 'version' },
            { matchType: common_1.TokenType.Colon },
            { matchType: potentialStringTypes, tokenMapKey: 'version' },
            { matchType: common_1.TokenType.Comma },
            { matchType: common_1.TokenType.Word, matchValue: 'classifier' },
            { matchType: common_1.TokenType.Colon },
            endOfInstruction,
        ],
        handler: processLongFormDep,
    },
    {
        // (group: "com.example", name: "my.dependency", version: "1.2.3", classifier:"class")
        matchers: [
            { matchType: common_1.TokenType.LeftParen },
            { matchType: common_1.TokenType.Word, matchValue: 'group' },
            { matchType: common_1.TokenType.Colon },
            { matchType: potentialStringTypes, tokenMapKey: 'groupId' },
            { matchType: common_1.TokenType.Comma },
            { matchType: common_1.TokenType.Word, matchValue: 'name' },
            { matchType: common_1.TokenType.Colon },
            { matchType: potentialStringTypes, tokenMapKey: 'artifactId' },
            { matchType: common_1.TokenType.Comma },
            { matchType: common_1.TokenType.Word, matchValue: 'version' },
            { matchType: common_1.TokenType.Colon },
            { matchType: potentialStringTypes, tokenMapKey: 'version' },
            { matchType: common_1.TokenType.Comma },
            { matchType: common_1.TokenType.Word, matchValue: 'classifier' },
            { matchType: common_1.TokenType.Colon },
            { matchType: potentialStringTypes, tokenMapKey: 'classifier' },
            { matchType: common_1.TokenType.RightParen },
            endOfInstruction,
        ],
        handler: processLongFormDep,
    },
    {
        // group: "com.example", name: "my.dependency", version: "1.2.3"{
        //        exclude module: 'exclude'
        //     }
        matchers: [
            { matchType: common_1.TokenType.Word, matchValue: 'group' },
            { matchType: common_1.TokenType.Colon },
            { matchType: potentialStringTypes, tokenMapKey: 'groupId' },
            { matchType: common_1.TokenType.Comma },
            { matchType: common_1.TokenType.Word, matchValue: 'name' },
            { matchType: common_1.TokenType.Colon },
            { matchType: potentialStringTypes, tokenMapKey: 'artifactId' },
            { matchType: common_1.TokenType.Comma },
            { matchType: common_1.TokenType.Word, matchValue: 'version' },
            { matchType: common_1.TokenType.Colon },
            { matchType: potentialStringTypes, tokenMapKey: 'version' },
            { matchType: common_1.TokenType.LeftBrace },
            { matchType: common_1.TokenType.Word, matchValue: 'exclude' },
            { matchType: common_1.TokenType.Word, matchValue: 'module' },
            { matchType: common_1.TokenType.Colon },
            { matchType: potentialStringTypes, tokenMapKey: 'exclude' },
            { matchType: common_1.TokenType.RightBrace },
            endOfInstruction,
        ],
        handler: processLongFormDep,
    },
    {
        // (group: "com.example", name: "my.dependency", version: "1.2.3"){
        //        exclude module: 'exclude'
        //     }
        matchers: [
            { matchType: common_1.TokenType.LeftParen },
            { matchType: common_1.TokenType.Word, matchValue: 'group' },
            { matchType: common_1.TokenType.Colon },
            { matchType: potentialStringTypes, tokenMapKey: 'groupId' },
            { matchType: common_1.TokenType.Comma },
            { matchType: common_1.TokenType.Word, matchValue: 'name' },
            { matchType: common_1.TokenType.Colon },
            { matchType: potentialStringTypes, tokenMapKey: 'artifactId' },
            { matchType: common_1.TokenType.Comma },
            { matchType: common_1.TokenType.Word, matchValue: 'version' },
            { matchType: common_1.TokenType.Colon },
            { matchType: potentialStringTypes, tokenMapKey: 'version' },
            { matchType: common_1.TokenType.RightParen },
            { matchType: common_1.TokenType.LeftBrace },
            { matchType: common_1.TokenType.Word, matchValue: 'exclude' },
            { matchType: common_1.TokenType.Word, matchValue: 'module' },
            { matchType: common_1.TokenType.Colon },
            { matchType: potentialStringTypes, tokenMapKey: 'exclude' },
            { matchType: common_1.TokenType.RightBrace },
            endOfInstruction,
        ],
        handler: processLongFormDep,
    },
    {
        // fooBarBaz("com.example", "my.dependency", "1.2.3")
        matchers: [
            { matchType: common_1.TokenType.Word, tokenMapKey: 'methodName' },
            { matchType: common_1.TokenType.LeftParen },
            { matchType: potentialStringTypes, tokenMapKey: 'groupId' },
            { matchType: common_1.TokenType.Comma },
            { matchType: potentialStringTypes, tokenMapKey: 'artifactId' },
            { matchType: common_1.TokenType.Comma },
            { matchType: potentialStringTypes, tokenMapKey: 'version' },
            { matchType: common_1.TokenType.RightParen },
        ],
        handler: processLongFormDep,
    },
    {
        // ("com.example", "my.dependency", "1.2.3")
        matchers: [
            { matchType: common_1.TokenType.LeftParen },
            { matchType: potentialStringTypes, tokenMapKey: 'groupId' },
            { matchType: common_1.TokenType.Comma },
            { matchType: potentialStringTypes, tokenMapKey: 'artifactId' },
            { matchType: common_1.TokenType.Comma },
            { matchType: potentialStringTypes, tokenMapKey: 'version' },
            { matchType: common_1.TokenType.RightParen },
        ],
        handler: processLongFormDep,
    },
    {
        // (group = "com.example", name = "my.dependency", version = "1.2.3")
        matchers: [
            { matchType: common_1.TokenType.LeftParen },
            { matchType: common_1.TokenType.Word, matchValue: 'group' },
            { matchType: common_1.TokenType.Assignment },
            { matchType: potentialStringTypes, tokenMapKey: 'groupId' },
            { matchType: common_1.TokenType.Comma },
            { matchType: common_1.TokenType.Word, matchValue: 'name' },
            { matchType: common_1.TokenType.Assignment },
            { matchType: potentialStringTypes, tokenMapKey: 'artifactId' },
            { matchType: common_1.TokenType.Comma },
            { matchType: common_1.TokenType.Word, matchValue: 'version' },
            { matchType: common_1.TokenType.Assignment },
            { matchType: potentialStringTypes, tokenMapKey: 'version' },
            { matchType: common_1.TokenType.RightParen },
        ],
        handler: processLongFormDep,
    },
];
function tryMatch({ tokens, variables, packageFile, }) {
    for (const { matchers, handler } of matcherConfigs) {
        const tokenMap = matchTokens(tokens, matchers);
        if (tokenMap) {
            const result = handler({
                packageFile,
                variables,
                tokenMap,
            });
            if (result !== null) {
                return result;
            }
        }
    }
    tokens.shift();
    return null;
}
function parseGradle(input, initVars = {}, packageFile) {
    let vars = { ...initVars };
    const deps = [];
    const urls = [];
    const tokens = (0, tokenizer_1.tokenize)(input);
    let prevTokensLength = tokens.length;
    while (tokens.length) {
        const matchResult = tryMatch({ tokens, variables: vars, packageFile });
        if (matchResult?.deps?.length) {
            deps.push(...matchResult.deps);
        }
        if (matchResult?.vars) {
            vars = { ...vars, ...matchResult.vars };
        }
        if (matchResult?.urls) {
            urls.push(...matchResult.urls);
        }
        // istanbul ignore if
        if (tokens.length >= prevTokensLength) {
            // Should not happen, but it's better to be prepared
            logger_1.logger.warn({ packageFile }, `${packageFile} parsing error, results can be incomplete`);
            break;
        }
        prevTokensLength = tokens.length;
    }
    return { deps, urls, vars };
}
exports.parseGradle = parseGradle;
const propWord = '[a-zA-Z_][a-zA-Z0-9_]*(?:\\.[a-zA-Z_][a-zA-Z0-9_]*)*';
const propRegex = (0, regex_1.regEx)(`^(?<leftPart>\\s*(?<key>${propWord})\\s*[= :]\\s*['"]?)(?<value>[^\\s'"]+)['"]?\\s*$`);
function parseProps(input, packageFile) {
    let offset = 0;
    const vars = {};
    const deps = [];
    for (const line of input.split(regex_1.newlineRegex)) {
        const lineMatch = propRegex.exec(line);
        if (lineMatch?.groups) {
            const { key, value, leftPart } = lineMatch.groups;
            if ((0, utils_1.isDependencyString)(value)) {
                const dep = (0, utils_1.parseDependencyString)(value);
                if (dep) {
                    deps.push({
                        ...dep,
                        managerData: {
                            fileReplacePosition: 
                            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                            offset + leftPart.length + dep.depName.length + 1,
                            packageFile,
                        },
                    });
                }
            }
            else {
                vars[key] = {
                    key,
                    value,
                    fileReplacePosition: offset + leftPart.length,
                    packageFile,
                };
            }
        }
        offset += line.length + 1;
    }
    return { vars, deps };
}
exports.parseProps = parseProps;
//# sourceMappingURL=parser.js.map