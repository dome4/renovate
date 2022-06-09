"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPackageFile = void 0;
const logger_1 = require("../../../logger");
const gradle_version_1 = require("../../datasource/gradle-version");
const gradle_1 = require("../../versioning/gradle");
const utils_1 = require("./utils");
function extractPackageFile(fileContent) {
    logger_1.logger.trace('gradle-wrapper.extractPackageFile()');
    const extractResult = (0, utils_1.extractGradleVersion)(fileContent);
    if (extractResult) {
        const dependency = {
            depName: 'gradle',
            currentValue: extractResult.version,
            replaceString: extractResult.url,
            datasource: gradle_version_1.GradleVersionDatasource.id,
            versioning: gradle_1.id,
        };
        return { deps: [dependency] };
    }
    return null;
}
exports.extractPackageFile = extractPackageFile;
//# sourceMappingURL=extract.js.map