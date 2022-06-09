"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rawExec = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
exports.rawExec = (0, util_1.promisify)(child_process_1.exec);
//# sourceMappingURL=common.js.map