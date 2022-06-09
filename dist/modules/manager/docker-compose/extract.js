"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPackageFile = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const js_yaml_1 = require("js-yaml");
const logger_1 = require("../../../logger");
const regex_1 = require("../../../util/regex");
const extract_1 = require("../dockerfile/extract");
class LineMapper {
    constructor(content, filter) {
        this.imageLines = [...content.split(regex_1.newlineRegex).entries()]
            .filter((entry) => filter.test(entry[1]))
            .map(([lineNumber, line]) => ({ lineNumber, line, used: false }));
    }
    pluckLineNumber(imageName) {
        const lineMeta = this.imageLines.find(({ line, used }) => !used && imageName && line.includes(imageName));
        // istanbul ignore if
        if (!lineMeta) {
            return null;
        }
        lineMeta.used = true; // unset plucked lines so duplicates are skipped
        return lineMeta.lineNumber;
    }
}
function extractPackageFile(content, fileName) {
    logger_1.logger.debug('docker-compose.extractPackageFile()');
    let config;
    try {
        // TODO: fix me (#9610)
        config = (0, js_yaml_1.load)(content, { json: true });
        if (!config) {
            logger_1.logger.debug({ fileName }, 'Null config when parsing Docker Compose content');
            return null;
        }
        if (typeof config !== 'object') {
            logger_1.logger.debug({ fileName, type: typeof config }, 'Unexpected type for Docker Compose content');
            return null;
        }
    }
    catch (err) {
        logger_1.logger.debug({ err }, 'err');
        logger_1.logger.debug({ fileName }, 'Parsing Docker Compose config YAML');
        return null;
    }
    try {
        const lineMapper = new LineMapper(content, (0, regex_1.regEx)(/^\s*image:/));
        // docker-compose v1 places the services at the top level,
        // docker-compose v2+ places the services within a 'services' key
        // since docker-compose spec version 1.27, the 'version' key has
        // become optional and can no longer be used to differentiate
        // between v1 and v2.
        const services = config.services || config;
        // Image name/tags for services are only eligible for update if they don't
        // use variables and if the image is not built locally
        const deps = Object.values(services || {})
            .filter((service) => is_1.default.string(service?.image) && !service?.build)
            .map((service) => {
            const dep = (0, extract_1.getDep)(service.image);
            const lineNumber = lineMapper.pluckLineNumber(service.image);
            // istanbul ignore if
            if (!lineNumber) {
                return null;
            }
            return dep;
        })
            .filter(is_1.default.truthy);
        logger_1.logger.trace({ deps }, 'Docker Compose image');
        return { deps };
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.warn({ fileName, content, err }, 'Error extracting Docker Compose file');
        return null;
    }
}
exports.extractPackageFile = extractPackageFile;
//# sourceMappingURL=extract.js.map