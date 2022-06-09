"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDependency = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const dequal_1 = require("dequal");
const logger_1 = require("../../../../../logger");
const regex_1 = require("../../../../../util/regex");
const string_1 = require("../../../../../util/string");
function renameObjKey(oldObj, oldKey, newKey) {
    const keys = Object.keys(oldObj);
    return keys.reduce((acc, key) => {
        if (key === oldKey) {
            acc[newKey] = oldObj[oldKey];
        }
        else {
            acc[key] = oldObj[key];
        }
        return acc;
    }, {});
}
function replaceAsString(parsedContents, fileContent, depType, depName, oldValue, newValue, parents) {
    if (depType === 'packageManager') {
        parsedContents[depType] = newValue;
    }
    else if (depName === oldValue) {
        // The old value is the name of the dependency itself
        delete Object.assign(parsedContents[depType], {
            [newValue]: parsedContents[depType][oldValue],
        })[oldValue];
    }
    else if (depType === 'dependenciesMeta') {
        if (oldValue !== newValue) {
            parsedContents.dependenciesMeta = renameObjKey(
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            parsedContents.dependenciesMeta, oldValue, newValue);
        }
    }
    else if (parents && depType === 'overrides') {
        // there is an object as a value in overrides block
        const { depObjectReference, overrideDepName } = overrideDepPosition(parsedContents[depType], parents, depName);
        if (depObjectReference) {
            depObjectReference[overrideDepName] = newValue;
        }
    }
    else {
        // The old value is the version of the dependency
        parsedContents[depType][depName] = newValue;
    }
    // Look for the old version number
    const searchString = `"${oldValue}"`;
    let newString = `"${newValue}"`;
    const escapedDepName = (0, regex_1.escapeRegExp)(depName);
    const patchRe = (0, regex_1.regEx)(`^(patch:${escapedDepName}@(npm:)?).*#`);
    const match = patchRe.exec(oldValue);
    if (match && depType === 'resolutions') {
        const patch = oldValue.replace(match[0], `${match[1]}${newValue}#`);
        parsedContents[depType][depName] = patch;
        newString = `"${patch}"`;
    }
    // Skip ahead to depType section
    let searchIndex = fileContent.indexOf(`"${depType}"`) + depType.length;
    logger_1.logger.trace(`Starting search at index ${searchIndex}`);
    // Iterate through the rest of the file
    for (; searchIndex < fileContent.length; searchIndex += 1) {
        // First check if we have a hit for the old version
        if ((0, string_1.matchAt)(fileContent, searchIndex, searchString)) {
            logger_1.logger.trace(`Found match at index ${searchIndex}`);
            // Now test if the result matches
            const testContent = (0, string_1.replaceAt)(fileContent, searchIndex, searchString, newString);
            // Compare the parsed JSON structure of old and new
            if ((0, dequal_1.dequal)(parsedContents, JSON.parse(testContent))) {
                return testContent;
            }
        }
    }
    // istanbul ignore next
    throw new Error();
}
function updateDependency({ fileContent, upgrade, }) {
    const { depType, managerData } = upgrade;
    const depName = managerData?.key || upgrade.depName;
    let { newValue } = upgrade;
    if (upgrade.currentRawValue) {
        if (upgrade.currentDigest) {
            logger_1.logger.debug('Updating package.json git digest');
            newValue = upgrade.currentRawValue.replace(upgrade.currentDigest, 
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            upgrade.newDigest.substring(0, upgrade.currentDigest.length));
        }
        else {
            logger_1.logger.debug('Updating package.json git version tag');
            newValue = upgrade.currentRawValue.replace(upgrade.currentValue, upgrade.newValue);
        }
    }
    if (upgrade.npmPackageAlias) {
        newValue = `npm:${upgrade.packageName}@${newValue}`;
    }
    logger_1.logger.debug(`npm.updateDependency(): ${depType}.${depName} = ${newValue}`);
    try {
        const parsedContents = JSON.parse(fileContent);
        let overrideDepParents = undefined;
        // Save the old version
        let oldVersion;
        if (depType === 'packageManager') {
            oldVersion = parsedContents[depType];
            newValue = `${depName}@${newValue}`;
        }
        else if (isOverrideObject(upgrade)) {
            overrideDepParents = managerData?.parents;
            if (overrideDepParents) {
                // old version when there is an object as a value in overrides block
                const { depObjectReference, overrideDepName } = overrideDepPosition(parsedContents['overrides'], overrideDepParents, depName);
                if (depObjectReference) {
                    oldVersion = depObjectReference[overrideDepName];
                }
            }
        }
        else {
            // eslint-disable @typescript-eslint/no-unnecessary-type-assertion
            oldVersion = parsedContents[depType][depName];
        }
        if (oldVersion === newValue) {
            logger_1.logger.trace('Version is already updated');
            return fileContent;
        }
        /* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
        let newFileContent = replaceAsString(parsedContents, fileContent, depType, depName, oldVersion, newValue, overrideDepParents);
        if (upgrade.newName) {
            newFileContent = replaceAsString(parsedContents, newFileContent, depType, depName, depName, upgrade.newName, overrideDepParents);
        }
        /* eslint-enable @typescript-eslint/no-unnecessary-type-assertion */
        // istanbul ignore if
        if (!newFileContent) {
            logger_1.logger.debug({ fileContent, parsedContents, depType, depName, newValue }, 'Warning: updateDependency error');
            return fileContent;
        }
        if (parsedContents?.resolutions) {
            let depKey;
            if (parsedContents.resolutions[depName]) {
                depKey = depName;
            }
            else if (parsedContents.resolutions[`**/${depName}`]) {
                depKey = `**/${depName}`;
            }
            if (depKey) {
                // istanbul ignore if
                if (parsedContents.resolutions[depKey] !== oldVersion) {
                    logger_1.logger.debug({
                        depName,
                        depKey,
                        oldVersion,
                        resolutionsVersion: parsedContents.resolutions[depKey],
                    }, 'Upgraded dependency exists in yarn resolutions but is different version');
                }
                newFileContent = replaceAsString(parsedContents, newFileContent, 'resolutions', depKey, parsedContents.resolutions[depKey], 
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                newValue);
                if (upgrade.newName) {
                    if (depKey === `**/${depName}`) {
                        // handles the case where a replacement is in a resolution
                        upgrade.newName = `**/${upgrade.newName}`;
                    }
                    newFileContent = replaceAsString(parsedContents, newFileContent, 'resolutions', depKey, depKey, upgrade.newName);
                }
            }
        }
        if (parsedContents?.dependenciesMeta) {
            for (const [depKey] of Object.entries(parsedContents.dependenciesMeta)) {
                if (depKey.startsWith(depName + '@')) {
                    newFileContent = replaceAsString(parsedContents, newFileContent, 'dependenciesMeta', depName, depKey, depName + '@' + newValue);
                }
            }
        }
        return newFileContent;
    }
    catch (err) {
        logger_1.logger.debug({ err }, 'updateDependency error');
        return null;
    }
}
exports.updateDependency = updateDependency;
function overrideDepPosition(overrideBlock, parents, depName) {
    // get override dep position when its nested in an object
    const lastParent = parents[parents.length - 1];
    let overrideDep = overrideBlock;
    for (const parent of parents) {
        if (overrideDep) {
            overrideDep = overrideDep[parent];
        }
    }
    const overrideDepName = depName === lastParent ? '.' : depName;
    const depObjectReference = overrideDep;
    return { depObjectReference, overrideDepName };
}
function isOverrideObject(upgrade) {
    return (is_1.default.array(upgrade.managerData?.parents, is_1.default.nonEmptyStringAndNotWhitespace) &&
        upgrade.depType === 'overrides');
}
//# sourceMappingURL=index.js.map