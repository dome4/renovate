"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPackageFile = void 0;
const tslib_1 = require("tslib");
const semver_1 = tslib_1.__importDefault(require("semver"));
const logger_1 = require("../../../logger");
const regex_1 = require("../../../util/regex");
const go_1 = require("../../datasource/go");
const semver_2 = require("../../versioning/semver");
function getDep(lineNumber, match, type) {
    const [, , currentValue] = match;
    let [, depName] = match;
    depName = depName.replace((0, regex_1.regEx)(/"/g), '');
    const dep = {
        managerData: {
            lineNumber,
        },
        depName,
        depType: type,
        currentValue,
    };
    if ((0, semver_2.isVersion)(currentValue)) {
        dep.datasource = go_1.GoDatasource.id;
    }
    else {
        dep.skipReason = 'unsupported-version';
    }
    const digestMatch = (0, regex_1.regEx)(/v0\.0.0-\d{14}-([a-f0-9]{12})/).exec(currentValue);
    if (digestMatch) {
        [, dep.currentDigest] = digestMatch;
        dep.digestOneAndOnly = true;
    }
    return dep;
}
function extractPackageFile(content) {
    logger_1.logger.trace({ content }, 'gomod.extractPackageFile()');
    const constraints = {};
    const deps = [];
    try {
        const lines = content.split(regex_1.newlineRegex);
        for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
            let line = lines[lineNumber];
            if (line.startsWith('go ') &&
                semver_1.default.validRange(line.replace('go ', ''))) {
                constraints.go = line.replace('go ', '^');
            }
            const replaceMatch = (0, regex_1.regEx)(/^replace\s+[^\s]+[\s]+[=][>]\s+([^\s]+)\s+([^\s]+)/).exec(line);
            if (replaceMatch) {
                const dep = getDep(lineNumber, replaceMatch, 'replace');
                deps.push(dep);
            }
            const requireMatch = (0, regex_1.regEx)(/^require\s+([^\s]+)\s+([^\s]+)/).exec(line);
            if (requireMatch && !line.endsWith('// indirect')) {
                logger_1.logger.trace({ lineNumber }, `require line: "${line}"`);
                const dep = getDep(lineNumber, requireMatch, 'require');
                deps.push(dep);
            }
            if (line.trim() === 'require (') {
                logger_1.logger.trace(`Matched multi-line require on line ${lineNumber}`);
                do {
                    lineNumber += 1;
                    line = lines[lineNumber];
                    const multiMatch = (0, regex_1.regEx)(/^\s+([^\s]+)\s+([^\s]+)/).exec(line);
                    logger_1.logger.trace(`reqLine: "${line}"`);
                    if (multiMatch && !line.endsWith('// indirect')) {
                        logger_1.logger.trace({ lineNumber }, `require line: "${line}"`);
                        const dep = getDep(lineNumber, multiMatch, 'require');
                        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                        dep.managerData.multiLine = true;
                        deps.push(dep);
                    }
                    else if (line.trim() !== ')') {
                        logger_1.logger.debug(`No multi-line match: ${line}`);
                    }
                } while (line.trim() !== ')');
            }
        }
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.warn({ err }, 'Error extracting go modules');
    }
    if (!deps.length) {
        return null;
    }
    return { constraints, deps };
}
exports.extractPackageFile = extractPackageFile;
//# sourceMappingURL=extract.js.map