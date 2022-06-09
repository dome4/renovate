"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findDepConstraints = void 0;
const logger_1 = require("../../../../../../logger");
const regex_1 = require("../../../../../../util/regex");
const npm_1 = require("../../../../../versioning/npm");
// Finds all parent dependencies for a given depName@currentVersion
function findDepConstraints(packageJson, lockEntry, depName, currentVersion, newVersion, parentDepName) {
    let parents = [];
    let packageJsonConstraint = packageJson.dependencies?.[depName];
    if (packageJsonConstraint &&
        npm_1.api.matches(currentVersion, packageJsonConstraint)) {
        parents.push({
            depType: 'dependencies',
            constraint: packageJsonConstraint,
        });
    }
    packageJsonConstraint = packageJson.devDependencies?.[depName];
    if (packageJsonConstraint &&
        npm_1.api.matches(currentVersion, packageJsonConstraint)) {
        parents.push({
            depType: 'devDependencies',
            constraint: packageJsonConstraint,
        });
    }
    const { dependencies, requires, version } = lockEntry;
    if (parentDepName && requires) {
        let constraint = requires[depName];
        if (constraint) {
            constraint = constraint.replace((0, regex_1.regEx)(/(\d)rc$/), '$1-rc');
            // istanbul ignore else
            if (npm_1.api.isValid(constraint)) {
                if (npm_1.api.matches(currentVersion, constraint)) {
                    if (constraint === currentVersion) {
                        // Workaround for old versions of npm which wrote the exact version in requires instead of the constraint
                        requires[depName] = newVersion;
                    }
                    parents.push({
                        parentDepName,
                        parentVersion: version,
                        constraint,
                    });
                }
            }
            else {
                logger_1.logger.warn({ parentDepName, depName, currentVersion, constraint }, 'Parent constraint is invalid');
            }
        }
    }
    if (dependencies) {
        for (const [packageName, dependency] of Object.entries(dependencies)) {
            parents = parents.concat(findDepConstraints(packageJson, dependency, depName, currentVersion, newVersion, packageName));
        }
    }
    // dedupe
    const res = [];
    for (const req of parents) {
        const reqStringified = JSON.stringify(req);
        if (!res.find((i) => JSON.stringify(i) === reqStringified)) {
            res.push(req);
        }
    }
    return res;
}
exports.findDepConstraints = findDepConstraints;
//# sourceMappingURL=dep-constraints.js.map