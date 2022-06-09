"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replaceConstraintVersion = void 0;
const logger_1 = require("../../../../../../logger");
const regex_1 = require("../../../../../../util/regex");
function replaceConstraintVersion(lockFileContent, depName, constraint, newVersion, newConstraint) {
    if (lockFileContent.startsWith('__metadata:')) {
        // Yarn 2+
        return lockFileContent;
    }
    const depNameConstraint = `${depName}@${constraint}`;
    const escaped = depNameConstraint.replace(/(@|\^|\.|\\)/g, '\\$1');
    const matchString = `(${escaped}(("|",|,)[^\n:]*)?:\n)(.*\n)*?(\\s+dependencies|\n[@a-z])`;
    // yarn will fill in the details later
    const matchResult = (0, regex_1.regEx)(matchString).exec(lockFileContent);
    // istanbul ignore if
    if (!matchResult) {
        logger_1.logger.debug({ depName, constraint, newVersion }, 'Could not find constraint in lock file');
        return lockFileContent;
    }
    let constraintLine = matchResult[1];
    if (newConstraint) {
        const newDepNameConstraint = `${depName}@${newConstraint}`;
        constraintLine = constraintLine.replace(depNameConstraint, newDepNameConstraint);
    }
    return lockFileContent.replace((0, regex_1.regEx)(matchString), `${constraintLine}  version "${newVersion}"\n$5`);
}
exports.replaceConstraintVersion = replaceConstraintVersion;
//# sourceMappingURL=replace.js.map