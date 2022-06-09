"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getManagerPackageFiles = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const logger_1 = require("../../../logger");
const manager_1 = require("../../../modules/manager");
const fs_1 = require("../../../util/fs");
async function getManagerPackageFiles(config) {
    const { enabled, manager, fileList } = config;
    logger_1.logger.trace(`getPackageFiles(${manager})`);
    if (!enabled) {
        logger_1.logger.debug(`${manager} is disabled`);
        return [];
    }
    // istanbul ignore else
    if (is_1.default.nonEmptyArray(fileList)) {
        logger_1.logger.debug(`Matched ${fileList.length} file(s) for manager ${manager}: ${fileList.join(', ')}`);
    }
    else {
        return [];
    }
    // Extract package files synchronously if manager requires it
    if ((0, manager_1.get)(manager, 'extractAllPackageFiles')) {
        const allPackageFiles = await (0, manager_1.extractAllPackageFiles)(manager, config, fileList);
        if (allPackageFiles) {
            for (const packageFile of allPackageFiles) {
                for (let index = 0; index < packageFile.deps.length; index += 1) {
                    packageFile.deps[index].depIndex = index;
                }
            }
        }
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        return allPackageFiles;
    }
    const packageFiles = [];
    for (const packageFile of fileList) {
        const content = await (0, fs_1.readLocalFile)(packageFile, 'utf8');
        // istanbul ignore else
        if (content) {
            const res = await (0, manager_1.extractPackageFile)(manager, content, packageFile, config);
            if (res) {
                for (let index = 0; index < res.deps.length; index += 1) {
                    res.deps[index].depIndex = index;
                }
                packageFiles.push({
                    packageFile,
                    ...res,
                });
            }
        }
        else {
            logger_1.logger.debug({ packageFile }, 'packageFile has no content');
        }
    }
    return packageFiles;
}
exports.getManagerPackageFiles = getManagerPackageFiles;
//# sourceMappingURL=manager-files.js.map