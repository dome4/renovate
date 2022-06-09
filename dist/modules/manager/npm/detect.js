"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectGlobalConfig = void 0;
const tslib_1 = require("tslib");
const os_1 = tslib_1.__importDefault(require("os"));
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const upath_1 = tslib_1.__importDefault(require("upath"));
const logger_1 = require("../../../logger");
const fs_1 = require("../../../util/fs");
async function detectGlobalConfig() {
    const res = {};
    const homedir = os_1.default.homedir();
    const npmrcFileName = upath_1.default.join(homedir, '.npmrc');
    try {
        const npmrc = await (0, fs_1.readFile)(npmrcFileName, 'utf8');
        if (is_1.default.nonEmptyString(npmrc)) {
            res.npmrc = npmrc;
            res.npmrcMerge = true;
            logger_1.logger.debug(`Detected ${npmrcFileName} and adding it to global config`);
        }
    }
    catch (err) {
        logger_1.logger.warn({ npmrcFileName }, 'Error reading .npmrc file');
    }
    return res;
}
exports.detectGlobalConfig = detectGlobalConfig;
//# sourceMappingURL=detect.js.map