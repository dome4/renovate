"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractAllPackageFiles = exports.resolveParents = exports.parseSettings = exports.extractRegistries = exports.extractPackage = exports.parsePom = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const upath_1 = tslib_1.__importDefault(require("upath"));
const xmldoc_1 = require("xmldoc");
const logger_1 = require("../../../logger");
const fs_1 = require("../../../util/fs");
const regex_1 = require("../../../util/regex");
const maven_1 = require("../../datasource/maven");
const common_1 = require("../../datasource/maven/common");
function parsePom(raw) {
    let project;
    try {
        project = new xmldoc_1.XmlDocument(raw);
    }
    catch (e) {
        return null;
    }
    const { name, attr, children } = project;
    if (name !== 'project') {
        return null;
    }
    if (attr.xmlns === 'http://maven.apache.org/POM/4.0.0') {
        return project;
    }
    if (is_1.default.nonEmptyArray(children) &&
        children.some((c) => c.name === 'modelVersion' && c.val === '4.0.0')) {
        return project;
    }
    return null;
}
exports.parsePom = parsePom;
function containsPlaceholder(str) {
    return !!str && (0, regex_1.regEx)(/\${.*?}/g).test(str);
}
function depFromNode(node, underBuildSettingsElement = false) {
    if (!('valueWithPath' in node)) {
        return null;
    }
    let groupId = node.valueWithPath('groupId')?.trim();
    const artifactId = node.valueWithPath('artifactId')?.trim();
    const currentValue = node.valueWithPath('version')?.trim();
    let depType;
    if (!groupId && node.name === 'plugin') {
        groupId = 'org.apache.maven.plugins';
    }
    if (groupId && artifactId && currentValue) {
        const depName = `${groupId}:${artifactId}`;
        const versionNode = node.descendantWithPath('version');
        const fileReplacePosition = versionNode.position;
        const datasource = maven_1.MavenDatasource.id;
        const registryUrls = [common_1.MAVEN_REPO];
        const result = {
            datasource,
            depName,
            currentValue,
            fileReplacePosition,
            registryUrls,
        };
        switch (node.name) {
            case 'plugin':
            case 'extension':
                depType = 'build';
                break;
            case 'parent':
                depType = 'parent';
                break;
            case 'dependency':
                if (underBuildSettingsElement) {
                    depType = 'build';
                }
                else if (node.valueWithPath('optional')?.trim() === 'true') {
                    depType = 'optional';
                }
                else {
                    depType = node.valueWithPath('scope')?.trim() ?? 'compile'; // maven default scope is compile
                }
                break;
        }
        if (depType) {
            result.depType = depType;
        }
        return result;
    }
    return null;
}
function deepExtract(node, result = [], isRoot = true, underBuildSettingsElement = false) {
    const dep = depFromNode(node, underBuildSettingsElement);
    if (dep && !isRoot) {
        result.push(dep);
    }
    if (node.children) {
        for (const child of node.children) {
            deepExtract(child, result, false, node.name === 'build' ||
                node.name === 'reporting' ||
                underBuildSettingsElement);
        }
    }
    return result;
}
function applyProps(dep, depPackageFile, props) {
    let result = dep;
    let anyChange = false;
    const alreadySeenProps = [];
    do {
        const [returnedResult, returnedAnyChange, fatal] = applyPropsInternal(result, depPackageFile, props, alreadySeenProps);
        if (fatal) {
            dep.skipReason = 'recursive-placeholder';
            return dep;
        }
        result = returnedResult;
        anyChange = returnedAnyChange;
    } while (anyChange);
    if (containsPlaceholder(result.depName)) {
        result.skipReason = 'name-placeholder';
    }
    else if (containsPlaceholder(result.currentValue)) {
        result.skipReason = 'version-placeholder';
    }
    return result;
}
function applyPropsInternal(dep, depPackageFile, props, alreadySeenProps) {
    let anyChange = false;
    let fatal = false;
    const replaceAll = (str) => str.replace((0, regex_1.regEx)(/\${.*?}/g), (substr) => {
        const propKey = substr.slice(2, -1).trim();
        // TODO: wrong types here, props is already `MavenProp`
        const propValue = props[propKey];
        if (propValue) {
            anyChange = true;
            if (alreadySeenProps.find((it) => it === propKey)) {
                fatal = true;
            }
            else {
                alreadySeenProps.push(propKey);
            }
            return propValue.val;
        }
        return substr;
    });
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const depName = replaceAll(dep.depName);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const registryUrls = dep.registryUrls.map((url) => replaceAll(url));
    let fileReplacePosition = dep.fileReplacePosition;
    let propSource = dep.propSource;
    let groupName = null;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const currentValue = dep.currentValue.replace((0, regex_1.regEx)(/^\${.*?}$/), (substr) => {
        const propKey = substr.slice(2, -1).trim();
        // TODO: wrong types here, props is already `MavenProp`
        const propValue = props[propKey];
        if (propValue) {
            if (!groupName) {
                groupName = propKey;
            }
            fileReplacePosition = propValue.fileReplacePosition;
            propSource = propValue.packageFile ?? undefined;
            anyChange = true;
            if (alreadySeenProps.find((it) => it === propKey)) {
                fatal = true;
            }
            else {
                alreadySeenProps.push(propKey);
            }
            return propValue.val;
        }
        return substr;
    });
    const result = {
        ...dep,
        depName,
        registryUrls,
        fileReplacePosition,
        propSource,
        currentValue,
    };
    if (groupName) {
        result.groupName = groupName;
    }
    if (propSource && depPackageFile !== propSource) {
        result.editFile = propSource;
    }
    return [result, anyChange, fatal];
}
function resolveParentFile(packageFile, parentPath) {
    let parentFile = 'pom.xml';
    let parentDir = parentPath;
    const parentBasename = upath_1.default.basename(parentPath);
    if (parentBasename === 'pom.xml' || parentBasename.endsWith('.pom.xml')) {
        parentFile = parentBasename;
        parentDir = upath_1.default.dirname(parentPath);
    }
    const dir = upath_1.default.dirname(packageFile);
    return upath_1.default.normalize(upath_1.default.join(dir, parentDir, parentFile));
}
function extractPackage(rawContent, packageFile = null) {
    if (!rawContent) {
        return null;
    }
    const project = parsePom(rawContent);
    if (!project) {
        return null;
    }
    const result = {
        datasource: maven_1.MavenDatasource.id,
        packageFile,
        deps: [],
    };
    result.deps = deepExtract(project);
    const propsNode = project.childNamed('properties');
    const props = {};
    if (propsNode?.children) {
        for (const propNode of propsNode.children) {
            const key = propNode.name;
            const val = propNode?.val?.trim();
            if (key && val) {
                const fileReplacePosition = propNode.position;
                props[key] = { val, fileReplacePosition, packageFile };
            }
        }
    }
    result.mavenProps = props;
    const repositories = project.childNamed('repositories');
    if (repositories?.children) {
        const repoUrls = [];
        for (const repo of repositories.childrenNamed('repository')) {
            const repoUrl = repo.valueWithPath('url')?.trim();
            if (repoUrl) {
                repoUrls.push(repoUrl);
            }
        }
        result.deps.forEach((dep) => {
            if (is_1.default.array(dep.registryUrls)) {
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                repoUrls.forEach((url) => dep.registryUrls.push(url));
            }
        });
    }
    if (packageFile && project.childNamed('parent')) {
        const parentPath = project.valueWithPath('parent.relativePath')?.trim() || '../pom.xml';
        result.parent = resolveParentFile(packageFile, parentPath);
    }
    if (project.childNamed('version')) {
        result.packageFileVersion = project.valueWithPath('version').trim();
    }
    return result;
}
exports.extractPackage = extractPackage;
function extractRegistries(rawContent) {
    if (!rawContent) {
        return [];
    }
    const settings = parseSettings(rawContent);
    if (!settings) {
        return [];
    }
    const urls = [];
    const mirrorUrls = parseUrls(settings, 'mirrors');
    urls.push(...mirrorUrls);
    settings.childNamed('profiles')?.eachChild((profile) => {
        const repositoryUrls = parseUrls(profile, 'repositories');
        urls.push(...repositoryUrls);
    });
    // filter out duplicates
    return [...new Set(urls)];
}
exports.extractRegistries = extractRegistries;
function parseUrls(xmlNode, path) {
    const children = xmlNode.descendantWithPath(path);
    const urls = [];
    if (children?.children) {
        children.eachChild((child) => {
            const url = child.valueWithPath('url');
            if (url) {
                urls.push(url);
            }
        });
    }
    return urls;
}
function parseSettings(raw) {
    let settings;
    try {
        settings = new xmldoc_1.XmlDocument(raw);
    }
    catch (e) {
        return null;
    }
    const { name, attr } = settings;
    if (name !== 'settings') {
        return null;
    }
    if (attr.xmlns === 'http://maven.apache.org/SETTINGS/1.0.0') {
        return settings;
    }
    return null;
}
exports.parseSettings = parseSettings;
function resolveParents(packages) {
    const packageFileNames = [];
    const extractedPackages = {};
    const extractedDeps = {};
    const extractedProps = {};
    const registryUrls = {};
    packages.forEach((pkg) => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        const name = pkg.packageFile;
        packageFileNames.push(name);
        extractedPackages[name] = pkg;
        extractedDeps[name] = [];
    });
    // Construct package-specific prop scopes
    // and merge them in reverse order,
    // which allows inheritance/overriding.
    packageFileNames.forEach((name) => {
        registryUrls[name] = new Set();
        const propsHierarchy = [];
        const visitedPackages = new Set();
        let pkg = extractedPackages[name];
        while (pkg) {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            propsHierarchy.unshift(pkg.mavenProps);
            if (pkg.deps) {
                pkg.deps.forEach((dep) => {
                    if (dep.registryUrls) {
                        dep.registryUrls.forEach((url) => {
                            registryUrls[name].add(url);
                        });
                    }
                });
            }
            if (pkg.parent && !visitedPackages.has(pkg.parent)) {
                visitedPackages.add(pkg.parent);
                pkg = extractedPackages[pkg.parent];
            }
            else {
                pkg = null;
            }
        }
        propsHierarchy.unshift({});
        extractedProps[name] = Object.assign.apply(null, propsHierarchy);
    });
    // Resolve registryUrls
    packageFileNames.forEach((name) => {
        const pkg = extractedPackages[name];
        pkg.deps.forEach((rawDep) => {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            const urlsSet = new Set([...rawDep.registryUrls, ...registryUrls[name]]);
            rawDep.registryUrls = [...urlsSet];
        });
    });
    // Resolve placeholders
    packageFileNames.forEach((name) => {
        const pkg = extractedPackages[name];
        pkg.deps.forEach((rawDep) => {
            const dep = applyProps(rawDep, name, extractedProps[name]);
            const sourceName = dep.propSource || name;
            extractedDeps[sourceName].push(dep);
        });
    });
    return packageFileNames.map((name) => ({
        ...extractedPackages[name],
        deps: extractedDeps[name],
    }));
}
exports.resolveParents = resolveParents;
function cleanResult(packageFiles) {
    packageFiles.forEach((packageFile) => {
        delete packageFile.mavenProps;
        packageFile.deps.forEach((dep) => {
            delete dep.propSource;
        });
    });
    return packageFiles;
}
async function extractAllPackageFiles(_config, packageFiles) {
    const packages = [];
    const additionalRegistryUrls = [];
    for (const packageFile of packageFiles) {
        const content = await (0, fs_1.readLocalFile)(packageFile, 'utf8');
        if (!content) {
            logger_1.logger.trace({ packageFile }, 'packageFile has no content');
            continue;
        }
        if (packageFile.endsWith('settings.xml')) {
            const registries = extractRegistries(content);
            if (registries) {
                logger_1.logger.debug({ registries, packageFile }, 'Found registryUrls in settings.xml');
                additionalRegistryUrls.push(...registries);
            }
        }
        else {
            const pkg = extractPackage(content, packageFile);
            if (pkg) {
                packages.push(pkg);
            }
            else {
                logger_1.logger.trace({ packageFile }, 'can not read dependencies');
            }
        }
    }
    if (additionalRegistryUrls) {
        for (const pkgFile of packages) {
            for (const dep of pkgFile.deps) {
                /* istanbul ignore else */
                if (dep.registryUrls) {
                    dep.registryUrls.push(...additionalRegistryUrls);
                }
                else {
                    dep.registryUrls = [...additionalRegistryUrls];
                }
            }
        }
    }
    return cleanResult(resolveParents(packages));
}
exports.extractAllPackageFiles = extractAllPackageFiles;
//# sourceMappingURL=extract.js.map