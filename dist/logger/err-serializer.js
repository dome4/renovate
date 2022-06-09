"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const utils_1 = tslib_1.__importDefault(require("./utils"));
Error.stackTraceLimit = 20;
function errSerializer(err) {
    const response = (0, utils_1.default)(err);
    // already done by `sanitizeValue` ?
    const redactedFields = ['message', 'stack', 'stdout', 'stderr'];
    for (const field of redactedFields) {
        const val = response[field];
        if (is_1.default.string(val)) {
            response[field] = val.replace(/https:\/\/[^@]*?@/g, // TODO #12874
            'https://**redacted**@');
        }
    }
    return response;
}
exports.default = errSerializer;
//# sourceMappingURL=err-serializer.js.map