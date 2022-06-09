"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aliasRecordToRepositories = exports.isOCIRegistry = exports.isAlias = exports.getRepositories = exports.resolveAlias = exports.parseRepository = void 0;
const logger_1 = require("../../../logger");
const docker_1 = require("../../datasource/docker");
function parseRepository(depName, repositoryURL) {
    const res = {};
    try {
        const url = new URL(repositoryURL);
        switch (url.protocol) {
            case 'oci:':
                res.datasource = docker_1.DockerDatasource.id;
                res.packageName = `${repositoryURL.replace('oci://', '')}/${depName}`;
                break;
            case 'file:':
                res.skipReason = 'local-dependency';
                break;
            default:
                res.registryUrls = [repositoryURL];
        }
    }
    catch (err) {
        logger_1.logger.debug({ err }, 'Error parsing url');
        res.skipReason = 'invalid-url';
    }
    return res;
}
exports.parseRepository = parseRepository;
/**
 * Resolves alias in repository string.
 *
 * @param repository to be resolved string
 * @param aliases Records containing aliases as key and to be resolved URLs as values
 *
 * @returns  resolved alias. If repository does not contain an alias the repository string will be returned. Should it contain an alias which can not be resolved using `aliases`, null will be returned
 */
function resolveAlias(repository, aliases) {
    if (!isAlias(repository)) {
        return repository;
    }
    const repoWithPrefixRemoved = repository.slice(repository[0] === '@' ? 1 : 6);
    const alias = aliases[repoWithPrefixRemoved];
    if (alias) {
        return alias;
    }
    return null;
}
exports.resolveAlias = resolveAlias;
function getRepositories(definitions) {
    const repositoryList = definitions
        .flatMap((value) => value.dependencies)
        .filter((dependency) => dependency.repository) // only keep non-local references --> if no repository is defined the chart will be searched in charts/<name>
        .filter((dependency) => !isAlias(dependency.repository)) // do not add aliases
        .filter((dependency) => !dependency.repository.startsWith('file:')) // skip repositories which are locally referenced
        .map((dependency) => {
        // remove additional keys to prevent interference at deduplication
        return {
            name: dependency.name,
            repository: dependency.repository,
        };
    });
    const dedup = new Set();
    return repositoryList.filter((el) => {
        const duplicate = dedup.has(el.repository);
        dedup.add(el.repository);
        return !duplicate;
    });
}
exports.getRepositories = getRepositories;
function isAlias(repository) {
    if (!repository) {
        return false;
    }
    return repository.startsWith('@') || repository.startsWith('alias:');
}
exports.isAlias = isAlias;
function isOCIRegistry(repository) {
    return repository.repository.startsWith('oci://');
}
exports.isOCIRegistry = isOCIRegistry;
function aliasRecordToRepositories(aliases) {
    return Object.entries(aliases).map(([alias, url]) => {
        return {
            name: alias,
            repository: url,
        };
    });
}
exports.aliasRecordToRepositories = aliasRecordToRepositories;
//# sourceMappingURL=utils.js.map