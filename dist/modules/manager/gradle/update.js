"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDependency = void 0;
const logger_1 = require("../../../logger");
const utils_1 = require("./utils");
function updateDependency({ fileContent, upgrade, }) {
    const { depName, currentValue, newValue, managerData, updateType } = upgrade;
    if (updateType === 'replacement') {
        logger_1.logger.warn('gradle manager does not support replacement updates yet');
        return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const offset = managerData.fileReplacePosition;
    const leftPart = fileContent.slice(0, offset);
    const rightPart = fileContent.slice(offset);
    const version = (0, utils_1.versionLikeSubstring)(rightPart);
    if (version) {
        const versionClosePosition = version.length;
        const restPart = rightPart.slice(versionClosePosition);
        if (version === newValue) {
            return fileContent;
        }
        if (version === currentValue || upgrade.groupName) {
            return leftPart + newValue + restPart;
        }
        logger_1.logger.debug({ depName, version, currentValue, newValue }, 'Unknown value');
    }
    else {
        logger_1.logger.debug({ depName, currentValue, newValue }, 'Wrong offset');
    }
    return null;
}
exports.updateDependency = updateDependency;
//# sourceMappingURL=update.js.map