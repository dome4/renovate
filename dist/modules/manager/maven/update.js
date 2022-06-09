"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bumpPackageVersion = exports.updateDependency = exports.updateAtPosition = void 0;
const tslib_1 = require("tslib");
const semver_1 = tslib_1.__importDefault(require("semver"));
const xmldoc_1 = require("xmldoc");
const logger_1 = require("../../../logger");
const string_1 = require("../../../util/string");
function updateAtPosition(fileContent, upgrade, endingAnchor) {
    const { depName, currentValue, newValue, fileReplacePosition } = upgrade;
    const leftPart = fileContent.slice(0, fileReplacePosition);
    const rightPart = fileContent.slice(fileReplacePosition);
    const versionClosePosition = rightPart.indexOf(endingAnchor);
    const restPart = rightPart.slice(versionClosePosition);
    const versionPart = rightPart.slice(0, versionClosePosition);
    const version = versionPart.trim();
    if (version === newValue) {
        return fileContent;
    }
    if (version === currentValue || upgrade.groupName) {
        // TODO: validate newValue
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        const replacedPart = versionPart.replace(version, newValue);
        return leftPart + replacedPart + restPart;
    }
    logger_1.logger.debug({ depName, version, currentValue, newValue }, 'Unknown value');
    return null;
}
exports.updateAtPosition = updateAtPosition;
function updateDependency({ fileContent, upgrade, }) {
    if (upgrade.updateType === 'replacement') {
        logger_1.logger.warn('maven manager does not support replacement updates yet');
        return null;
    }
    const offset = fileContent.indexOf('<');
    const spaces = fileContent.slice(0, offset);
    const restContent = fileContent.slice(offset);
    const updatedContent = updateAtPosition(restContent, upgrade, '</');
    if (!updatedContent) {
        return null;
    }
    if (updatedContent === restContent) {
        return fileContent;
    }
    return `${spaces}${updatedContent}`;
}
exports.updateDependency = updateDependency;
function bumpPackageVersion(content, currentValue, bumpVersion) {
    logger_1.logger.debug({ bumpVersion, currentValue }, 'Checking if we should bump pom.xml version');
    let bumpedContent = content;
    if (!currentValue) {
        logger_1.logger.warn('Unable to bump pom.xml version, pom.xml has no version');
        return { bumpedContent };
    }
    if (!semver_1.default.valid(currentValue)) {
        logger_1.logger.warn({ currentValue }, 'Unable to bump pom.xml version, not a valid semver');
        return { bumpedContent };
    }
    try {
        const project = new xmldoc_1.XmlDocument(content);
        const versionNode = project.childNamed('version');
        const startTagPosition = versionNode.startTagPosition;
        const versionPosition = content.indexOf(versionNode.val, startTagPosition);
        const newPomVersion = semver_1.default.inc(currentValue, bumpVersion);
        if (!newPomVersion) {
            throw new Error('semver inc failed');
        }
        logger_1.logger.debug({ newPomVersion });
        bumpedContent = (0, string_1.replaceAt)(content, versionPosition, currentValue, newPomVersion);
        if (bumpedContent === content) {
            logger_1.logger.debug('Version was already bumped');
        }
        else {
            logger_1.logger.debug('pom.xml version bumped');
        }
    }
    catch (err) {
        logger_1.logger.warn({
            content,
            currentValue,
            bumpVersion,
        }, 'Failed to bumpVersion');
    }
    return { bumpedContent };
}
exports.bumpPackageVersion = bumpPackageVersion;
//# sourceMappingURL=update.js.map