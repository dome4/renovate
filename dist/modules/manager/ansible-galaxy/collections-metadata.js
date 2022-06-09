"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractCollectionsMetaDataFile = void 0;
const galaxy_collection_1 = require("../../datasource/galaxy-collection");
const util_1 = require("./util");
function extractCollectionsMetaDataFile(lines) {
    const deps = [];
    // in a galaxy.yml the dependency map is inside a `dependencies:` block
    let foundDependencyBlock = false;
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
        const line = lines[lineNumber];
        if (util_1.dependencyRegex.exec(line)) {
            foundDependencyBlock = true;
        }
        else if (foundDependencyBlock) {
            // expects a line like this `  ansible.windows: "1.4.0"`
            const galaxyRegExResult = util_1.galaxyRegEx.exec(line);
            if (galaxyRegExResult?.groups) {
                const dep = {
                    depType: 'galaxy-collection',
                    datasource: galaxy_collection_1.GalaxyCollectionDatasource.id,
                    depName: galaxyRegExResult.groups.packageName,
                    currentValue: galaxyRegExResult.groups.version,
                };
                deps.push(dep);
            }
            else {
                // if we can not match additional lines, the block has ended.
                break;
            }
        }
    }
    return deps;
}
exports.extractCollectionsMetaDataFile = extractCollectionsMetaDataFile;
//# sourceMappingURL=collections-metadata.js.map