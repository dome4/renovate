"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const simple_git_1 = tslib_1.__importDefault(require("simple-git"));
const upath_1 = tslib_1.__importDefault(require("upath"));
const global_1 = require("../../../config/global");
const logger_1 = require("../../../logger");
async function updateDependency({ fileContent, upgrade, }) {
    const { localDir } = global_1.GlobalConfig.get();
    const git = (0, simple_git_1.default)(localDir);
    const submoduleGit = (0, simple_git_1.default)(upath_1.default.join(localDir, upgrade.depName));
    try {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        await git.submoduleUpdate(['--init', upgrade.depName]);
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        await submoduleGit.checkout([upgrade.newDigest]);
        return fileContent;
    }
    catch (err) {
        logger_1.logger.debug({ err }, 'submodule checkout error');
        return null;
    }
}
exports.default = updateDependency;
//# sourceMappingURL=update.js.map