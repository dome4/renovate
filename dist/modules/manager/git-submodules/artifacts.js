"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../../../logger");
function updateArtifacts({ updatedDeps, }) {
    const res = [];
    updatedDeps.forEach((dep) => {
        logger_1.logger.info('Updating submodule ' + dep.depName);
        res.push({
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            file: { type: 'addition', path: dep.depName, contents: '' },
        });
    });
    return res;
}
exports.default = updateArtifacts;
//# sourceMappingURL=artifacts.js.map