"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPackageFile = void 0;
const logger_1 = require("../../../logger");
const regex_1 = require("../../../util/regex");
const npm_1 = require("../../datasource/npm");
function extractPackageFile(content) {
    let deps = [];
    const npmDepends = (0, regex_1.regEx)(/\nNpm\.depends\({([\s\S]*?)}\);/).exec(content);
    if (!npmDepends) {
        return null;
    }
    try {
        deps = npmDepends[1]
            .replace((0, regex_1.regEx)(/(\s|\\n|\\t|'|")/g), '')
            .split(',')
            .map((dep) => dep.trim())
            .filter((dep) => dep.length)
            .map((dep) => dep.split((0, regex_1.regEx)(/:(.*)/)))
            .map((arr) => {
            const [depName, currentValue] = arr;
            // istanbul ignore if
            if (!(depName && currentValue)) {
                logger_1.logger.warn({ content }, 'Incomplete npm.depends match');
            }
            return {
                depName,
                currentValue,
                datasource: npm_1.NpmDatasource.id,
            };
        })
            .filter((dep) => dep.depName && dep.currentValue);
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.warn({ content }, 'Failed to parse meteor package.js');
    }
    // istanbul ignore if
    if (!deps.length) {
        return null;
    }
    return { deps };
}
exports.extractPackageFile = extractPackageFile;
//# sourceMappingURL=extract.js.map