"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDependency = void 0;
const logger_1 = require("../../../logger");
const regex_1 = require("../../../util/regex");
function getDepNameWithNoVersion(depName) {
    let depNameNoVersion = depName.split('/').slice(0, 3).join('/');
    if (depNameNoVersion.startsWith('gopkg.in')) {
        depNameNoVersion = depNameNoVersion.replace((0, regex_1.regEx)(/\.v\d+$/), '');
    }
    return depNameNoVersion;
}
function updateDependency({ fileContent, upgrade, }) {
    try {
        logger_1.logger.debug(`gomod.updateDependency: ${upgrade.newValue}`);
        const { depName, depType, updateType } = upgrade;
        if (updateType === 'replacement') {
            logger_1.logger.warn('gomod manager does not support replacement updates yet');
            return null;
        }
        // istanbul ignore if: should never happen
        if (!depName || !upgrade.managerData) {
            return null;
        }
        const depNameNoVersion = getDepNameWithNoVersion(depName);
        const lines = fileContent.split(regex_1.newlineRegex);
        const lineToChange = lines[upgrade.managerData.lineNumber];
        if (!lineToChange.includes(depNameNoVersion) &&
            !lineToChange.includes('rethinkdb/rethinkdb-go.v5')) {
            logger_1.logger.debug({ lineToChange, depName }, "go.mod current line doesn't contain dependency");
            return null;
        }
        let updateLineExp;
        if (depType === 'replace') {
            updateLineExp = (0, regex_1.regEx)(/^(?<depPart>replace\s+[^\s]+[\s]+[=][>]+\s+)(?<divider>[^\s]+\s+)[^\s]+/);
        }
        else if (depType === 'require') {
            if (upgrade.managerData.multiLine) {
                updateLineExp = (0, regex_1.regEx)(/^(?<depPart>\s+[^\s]+)(?<divider>\s+)[^\s]+/);
            }
            else {
                updateLineExp = (0, regex_1.regEx)(/^(?<depPart>require\s+[^\s]+)(?<divider>\s+)[^\s]+/);
            }
        }
        if (updateLineExp && !updateLineExp.test(lineToChange)) {
            logger_1.logger.debug('No image line found');
            return null;
        }
        let newLine;
        if (upgrade.updateType === 'digest') {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            const newDigestRightSized = upgrade.newDigest.substring(0, 
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            upgrade.currentDigest.length);
            if (lineToChange.includes(newDigestRightSized)) {
                return fileContent;
            }
            logger_1.logger.debug({ depName, lineToChange, newDigestRightSized }, 'gomod: need to update digest');
            newLine = lineToChange.replace(
            // TODO: can be undefined?
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            updateLineExp, `$<depPart>$<divider>${newDigestRightSized}`);
        }
        else {
            newLine = lineToChange.replace(
            // TODO: can be undefined?
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            updateLineExp, `$<depPart>$<divider>${upgrade.newValue}`);
        }
        if (upgrade.updateType === 'major') {
            logger_1.logger.debug({ depName }, 'gomod: major update');
            if (depName.startsWith('gopkg.in/')) {
                const oldV = depName.split('.').pop();
                newLine = newLine.replace(`.${oldV}`, `.v${upgrade.newMajor}`);
                // Package renames - I couldn't think of a better place to do this
                newLine = newLine.replace('gorethink/gorethink.v5', 'rethinkdb/rethinkdb-go.v5');
            }
            else if (
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            upgrade.newMajor > 1 &&
                !newLine.includes(`/v${upgrade.newMajor}`)) {
                if (depName === depNameNoVersion) {
                    // If package currently has no version, pin to latest one.
                    newLine = newLine.replace(depName, `${depName}/v${upgrade.newMajor}`);
                }
                else {
                    // Replace version
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                    const [oldV] = upgrade.currentValue.split('.');
                    newLine = newLine.replace((0, regex_1.regEx)(`/${oldV}(\\s+)`, undefined, false), `/v${upgrade.newMajor}$1`);
                }
            }
        }
        if (lineToChange.endsWith('+incompatible')) {
            let toAdd = '+incompatible';
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            if (upgrade.updateType === 'major' && upgrade.newMajor >= 2) {
                toAdd = '';
            }
            newLine += toAdd;
        }
        if (newLine === lineToChange) {
            logger_1.logger.debug('No changes necessary');
            return fileContent;
        }
        lines[upgrade.managerData.lineNumber] = newLine;
        return lines.join('\n');
    }
    catch (err) {
        logger_1.logger.debug({ err }, 'Error setting new go.mod version');
        return null;
    }
}
exports.updateDependency = updateDependency;
//# sourceMappingURL=update.js.map